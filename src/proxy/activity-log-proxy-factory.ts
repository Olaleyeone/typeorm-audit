import { ActivityLog, Status } from '../data/entity/ActivityLog';
import { Activity } from '../decorator/activity';
import { DIContainer, ConstructorFunction, Provider } from 'di-node';
import { Connection, EntityManager } from 'typeorm';
import { ChronoUnit, Instant, OffsetDateTime } from '@js-joda/core';

export function createActivityLogProxy<T>(constructor: ConstructorFunction<T>, provider: Provider<T>, container: DIContainer): T {

  let target: T;
  const proxy = Object.create(constructor.prototype);
  // console.log(`Created proxy of ${constructor.name}`);

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
          return propertyValue = createActivityRunner(container, constructor, propertyName);
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
  return () => {
    const activityName: string = Reflect.getMetadata(Activity.metadataKey, constructor, methodName);

    const activity = new ActivityLog(activityName);
    const connection: Connection = container.get(Connection);
    activity.description = connection.name;
    console.log('Activity started', activity);

    const realTarget: any = container.createInstance(constructor);
    const previousActivity = (connection as any)[Activity.metadataKey];

    if (previousActivity) {
      activity.parent = previousActivity;
      previousActivity.children.push(activity);
    }

    (connection as any)[Activity.metadataKey] = activity;
    let result;
    try {
      result = realTarget[methodName].call(realTarget, arguments);
      if (result.constructor === Promise) {
        result
          .catch(e => {
            activity.status = Status.FAILED;
            throw e;
          })
          .finally(() => {
            completeActivity(activity, connection, previousActivity);
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
      completeActivity(activity, connection, previousActivity);
    }
  };
}

function completeActivity(activity: ActivityLog, connection: Connection, previousActivity: any) {
  activity.duration.nanoSecondsTaken = Instant.ofEpochMilli(activity.duration.startedAt.getTime()).until(
    OffsetDateTime.now(), ChronoUnit.NANOS);
  if (activity.status === Status.STARTED) {
    activity.status = Status.SUCCESSFUL;
  }
  (connection as any)[Activity.metadataKey] = previousActivity;
  console.log('Activity ended', activity);
  if (activity.parent) {
    return;
  }
  persistTaskActivity(activity, connection.manager);
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