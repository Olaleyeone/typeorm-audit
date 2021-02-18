import { ActivityLog, Status } from '../data/entity/ActivityLog';
import { Activity } from '../decorator/activity';
import { DIContainer, LazyDIContainer, ConstructorFunction } from '@olaleyeone/di-node';
import { Connection, EntityManager } from 'typeorm';
import { ChronoUnit, Instant, OffsetDateTime } from '@js-joda/core';
import { Transactional } from '../decorator/transactional';
import { createTransactionRunner } from './transactional-runner';
import { getTransactionLog } from '../service/entity-state.service';
import { getActivityLog, setActivityLog } from '../data/subscriber/persistence-listener';

const activityNameKey = Symbol('activity:name');

export function createActivityRunner(parentContainer: DIContainer, constructor: ConstructorFunction<any>, methodName: string) {

    const activityName: string = Reflect.getMetadata(Activity.metadataKey, constructor, methodName);

    const parentEntityManager: EntityManager = parentContainer.get(EntityManager);
    // console.log(activityName, parentEntityManager.queryRunner?.data);
    let container: DIContainer;
    if (parentEntityManager.queryRunner?.data && (parentEntityManager.queryRunner?.data as any)[activityNameKey]) {
        container = parentContainer;
    } else {
        container = createActivityContainer(parentContainer, activityName);
    }

    return runInContainer(activityName, container, constructor, methodName);
}

function runInContainer(activityName: string, container: DIContainer, constructor: ConstructorFunction<any>, methodName: string) {
    return () => {
        const activity = createActivity(activityName, container);
        const entityManager = container.getInstance(EntityManager);
        console.log(activityName, entityManager.queryRunner?.data);

        let result;
        try {
            const transactional: string = Reflect.getMetadata(Transactional.metadataKey, constructor, methodName);
            if (transactional) {
                result = createTransactionRunner(container, constructor, methodName).call(null, arguments);
            } else {
                const realTarget: any = container.createInstance(constructor);
                activity.transaction = getTransactionLog(entityManager);
                result = realTarget[methodName].call(realTarget, arguments);
            }

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

function createActivityContainer(parentContainer: DIContainer, activityName: string) {
    const connection: Connection = parentContainer.get(Connection);
    return (parentContainer as LazyDIContainer).clone([
        {
            provide: EntityManager,
            with: () => {
                const queryRunner = connection.createQueryRunner();
                if (!queryRunner.data) {
                    queryRunner.data = {};
                }
                (queryRunner.data as any)[activityNameKey] = activityName;
                return connection.createEntityManager(queryRunner);
            },
            proxy: false
        }
    ]);
}

function createActivity(activityName: string, container: DIContainer) {
    const entityManager: EntityManager = container.get(EntityManager);
    const activity = new ActivityLog(activityName);
    const previousActivity = getActivityLog(entityManager);
    setActivityLog(entityManager, activity);

    if (previousActivity) {
        activity.parent = previousActivity;
        previousActivity.children.push(activity);
    }
    return activity;
}

async function completeActivity(activity: ActivityLog, entityManager: EntityManager) {
    if (activity.status === Status.SUCCESSFUL) {
        if (activity.depth === 1) {
            entityManager.queryRunner.release();
        }
        return;
    }
    activity.duration.nanoSecondsTaken = Instant.ofEpochMilli(activity.duration.startedAt.getTime()).until(
        OffsetDateTime.now(), ChronoUnit.NANOS);
    console.log(`completed "${activity.name}" in ${activity.duration.nanoSecondsTaken / 1000000}ms`);
    if (activity.status === Status.STARTED) {
        activity.status = Status.SUCCESSFUL;
    }
    // console.log('Activity ended', activity);
    if (activity.parent) {
        return;
    }
    setActivityLog(entityManager, null);
    persistTaskActivity(activity, entityManager);
}

async function persistTaskActivity(taskActivity: ActivityLog, entityManager: EntityManager) {
    console.log('saving activity log: ', taskActivity.name);
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
    entityManager.queryRunner.release();
}