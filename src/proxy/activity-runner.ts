import { ActivityLog, Status } from '../data/entity/ActivityLog';
import { Activity } from '../decorator/activity';
import { DIContainer, LazyDIContainer, ConstructorFunction } from 'di-node';
import { Connection, EntityManager } from 'typeorm';
import { ChronoUnit, Instant, OffsetDateTime } from '@js-joda/core';

export const runnerKey = Symbol('activity:name');

export function createActivityRunner(parentContainer: DIContainer, constructor: ConstructorFunction<any>, methodName: string) {

    const activityName: string = Reflect.getMetadata(Activity.metadataKey, constructor, methodName);

    const parentEntityManager: EntityManager = parentContainer.get(EntityManager);
    console.log(activityName, parentEntityManager.queryRunner?.data);
    let container: DIContainer;
    if (parentEntityManager.queryRunner?.data && (parentEntityManager.queryRunner?.data as any)[runnerKey]) {
        container = parentContainer;
    } else {
        console.log(methodName);
        container = createActivityContainer(parentContainer, activityName);
    }

    return () => {
        const activity = createActivity(activityName, container);
        const entityManager = container.getInstance(EntityManager);

        let result;
        try {
            const realTarget: any = container.createInstance(constructor);
            result = realTarget[methodName].call(realTarget, arguments);
            if (result.constructor === Promise) {
                result
                    .catch(e => {
                        activity.status = Status.FAILED;
                        throw e;
                    })
                    .finally(() => {
                        completeActivity(activity, entityManager);
                    });
            }
            return result;
        } catch (e) {
            activity.status = Status.FAILED;
            throw e;
        } finally {
            if (result?.constructor === Promise) {
                return result;
            }
            completeActivity(activity, entityManager);
        }
    };
}

function createActivityContainer(parentContainer: DIContainer, activityname: string) {
    const connection: Connection = parentContainer.get(Connection);
    return (parentContainer as LazyDIContainer).clone([
        {
            provide: EntityManager,
            with: () => {
                const queryRunner = connection.createQueryRunner();
                if (!queryRunner.data) {
                    queryRunner.data = {};
                }
                (queryRunner.data as any)[runnerKey] = activityname;
                return connection.createEntityManager(queryRunner);
            },
            proxy: false
        }
    ]);
}

function createActivity(activityName: string, container: DIContainer) {
    const entityManager: EntityManager = container.get(EntityManager);
    const activity = new ActivityLog(activityName);
    const previousActivity = (entityManager.queryRunner as any)[Activity.metadataKey];
    (entityManager.queryRunner as any)[Activity.metadataKey] = activity;

    if (previousActivity) {
        activity.parent = previousActivity;
        previousActivity.children.push(activity);
    }
    return activity;
}

async function completeActivity(activity: ActivityLog, entityManager: EntityManager) {
    activity.duration.nanoSecondsTaken = Instant.ofEpochMilli(activity.duration.startedAt.getTime()).until(
        OffsetDateTime.now(), ChronoUnit.NANOS);
    if (activity.status === Status.STARTED) {
        activity.status = Status.SUCCESSFUL;
    }
    // console.log('Activity ended', activity);
    if (activity.parent) {
        return;
    }
    (entityManager.queryRunner as any)[Activity.metadataKey] = activity.parent;
    await persistTaskActivity(activity, entityManager);
    entityManager.queryRunner.release();
}

async function persistTaskActivity(taskActivity: ActivityLog, entityManager: EntityManager) {
    if (taskActivity.id) {
        const existing = await entityManager.findOne(ActivityLog, taskActivity.id);
        if (existing) {
            await entityManager.save(taskActivity);
            if (taskActivity.children) {
                await Promise.all(taskActivity.children.map(e => persistTaskActivity(e, entityManager)));
            }
            return;
        }
        delete taskActivity.id;
    }
    await entityManager.save(taskActivity);
    if (taskActivity.children) {
        await Promise.all(taskActivity.children.map(e => persistTaskActivity(e, entityManager)));
    }
}