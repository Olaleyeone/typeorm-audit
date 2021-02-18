import { ActivityLog, Status } from '../data/entity/ActivityLog';
import { Activity } from '../decorator/activity';
import { DIContainer, ConstructorFunction } from '@olaleyeone/di-node';
import { EntityManager } from 'typeorm';
import { Transactional } from '../decorator/transactional';
import { createTransactionRunner } from './transactional-runner';
import { getTransactionLog } from '../service/entity-state.service';
import { getActivityContainer } from './activity-container';
import { createActivity, finishActivity } from './activity-factory';

export function createActivityRunner(
  parentContainer: DIContainer,
  constructor: ConstructorFunction<any>,
  methodName: string,
) {
  const activityName: string = Reflect.getMetadata(Activity.metadataKey, constructor, methodName);
  let container: DIContainer = getActivityContainer(parentContainer, activityName);

  return () => {
    const activity = createActivity(activityName, container);
    const entityManager = container.getInstance(EntityManager);
    activity.transaction = getTransactionLog(entityManager);

    // console.log(activityName, entityManager.queryRunner?.data);

    let result;
    try {
      const transactional: string = Reflect.getMetadata(Transactional.metadataKey, constructor, methodName);
      if (transactional) {
        result = createTransactionRunner(container, constructor, methodName).call(null, arguments);
      } else {
        result = getActivityResult(container, constructor, methodName);
      }
      awaitActivityCompletion(result, activity, entityManager);
      return result;
    } catch (e) {
      activity.status = Status.FAILED;
      throw e;
    } finally {
      if (result?.constructor !== Promise) {
        // complete activity if it is synchronous
        finishActivity(activity, entityManager);
      }
    }
  };
}

function awaitActivityCompletion(result: any, activity: ActivityLog, entityManager: EntityManager) {
  if (result?.constructor !== Promise) {
    return;
  }
  result
    .catch((e) => {
      activity.status = Status.FAILED;
      throw e;
    })
    .finally(() => {
      finishActivity(activity, entityManager);
    });
}

function getActivityResult(container: DIContainer, constructor: ConstructorFunction<any>, methodName: string) {
  const realTarget: any = container.createInstance(constructor);
  return realTarget[methodName].call(realTarget, arguments);
}
