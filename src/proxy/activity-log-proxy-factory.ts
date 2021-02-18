import { ActivityLog, Status } from '../data/entity/ActivityLog';
import { Activity } from '../decorator/activity';
import { DIContainer, LazyDIContainer, ConstructorFunction, Provider } from 'di-node';
import { Connection, EntityManager } from 'typeorm';
import { ChronoUnit, Instant, OffsetDateTime } from '@js-joda/core';

const queryRunnerKey = Symbol('queryRunner');

export function createActivityLogProxy<T>(constructor: ConstructorFunction<T>, provider: Provider<T>, container: DIContainer): T {

  let target: T;
  const proxy = Object.create(constructor.prototype);

  Object.getOwnPropertyNames(constructor.prototype).forEach((propertyName) => {
    if (propertyName === 'constructor') {
      return;
    }

    let propertyValue: any;

    Object.defineProperty(proxy, propertyName, {
      get: () => {
        if (propertyValue) {
          return propertyValue;
        }

        const activityName: string = Reflect.getMetadata(Activity.metadataKey, constructor, propertyName);
        if (activityName) {
          const activityContainer: LazyDIContainer = createActivityContainer(container);
          return propertyValue = createActivityRunner(activityContainer, constructor, propertyName);
        }

        const _this: any = target || (target = provider());
        return propertyValue = _this[propertyName].bind(_this);
      },

      set: (value) => {
        const _this: any = target || (target = provider());
        propertyValue = null;
        _this[propertyName] = value;
      },
    });
  });
  return proxy;
}

function createActivityRunner(container: DIContainer, constructor: ConstructorFunction<any>, methodName: string) {

  const activityName: string = Reflect.getMetadata(Activity.metadataKey, constructor, methodName);
  const entityManager: EntityManager = container.get(EntityManager);

  return () => {
    const activity = createActivity(activityName, container);

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

function createActivityContainer(parentContainer: DIContainer) {
  const connection: Connection = parentContainer.get(Connection);
  const container: LazyDIContainer = (parentContainer as LazyDIContainer).clone([
    {
      provide: EntityManager,
      with: () => {
        let queryRunner = (container as any)[queryRunnerKey];
        return connection.createEntityManager(queryRunner);
      },
      proxy: false
    }
  ]);

  let queryRunner = (parentContainer as any)[queryRunnerKey];
  if (!queryRunner) {
    queryRunner = connection.createQueryRunner();
  }
  (container as any)[queryRunnerKey] = queryRunner;
  return container;
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