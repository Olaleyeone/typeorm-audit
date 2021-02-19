import { ActivityLog, Status } from '../data/entity/ActivityLog';
import { DIContainer } from '@olaleyeone/di-node';
import { EntityManager } from 'typeorm';
import { ChronoUnit, Instant, OffsetDateTime } from '@js-joda/core';
import { getActivityLog, setActivityLog } from '../listener/persistence-listener';

export function createActivity(activityName: string, container: DIContainer) {
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

export function finishActivity(activity: ActivityLog, entityManager: EntityManager) {
  if (activity.status === Status.SUCCESSFUL) {
    // console.log(`"${activity.name}" ${activity.status} in ${activity.duration.nanoSecondsTaken / 1000000}ms`);
    if (activity.depth === 1) {
      entityManager.queryRunner.release();
    }
    return;
  }
  activity.duration.nanoSecondsTaken = Instant.ofEpochMilli(activity.duration.startedAt.getTime()).until(
    OffsetDateTime.now(),
    ChronoUnit.NANOS,
  );
  if (activity.status === Status.STARTED) {
    activity.status = Status.SUCCESSFUL;
  }
  // console.log(`"${activity.name}" ${activity.status} in ${activity.duration.nanoSecondsTaken / 1000000}ms`);
  // console.log('Activity ended', activity);
  if (activity.parent) {
    return;
  }
  setActivityLog(entityManager, null);
  saveActivityLog(activity, entityManager);
}

async function saveActivityLog(taskActivity: ActivityLog, entityManager: EntityManager) {
  // console.log('saving activity log: ', taskActivity.name);
  if (taskActivity.id) {
    const existing = await entityManager.findOne(ActivityLog, taskActivity.id);
    if (existing) {
      await entityManager.save(taskActivity);
      if (taskActivity.children) {
        await Promise.all(taskActivity.children.map((e) => saveActivityLog(e, entityManager)));
      }
      return;
    }
    delete taskActivity.id;
  }
  await entityManager.save(taskActivity);
  if (taskActivity.children) {
    await Promise.all(taskActivity.children.map((e) => saveActivityLog(e, entityManager)));
  }
  entityManager.queryRunner.release();
}
