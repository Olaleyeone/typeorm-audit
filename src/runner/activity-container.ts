import { DIContainer, LazyDIContainer } from '@olaleyeone/di-node';
import { EntityManager } from 'typeorm';

const activityNameKey = Symbol('activity:name');

export function getActivityContainer(parentContainer: DIContainer, activityName: string) {
  const parentEntityManager: EntityManager = parentContainer.get(EntityManager);
  let container: DIContainer;
  if (parentEntityManager.queryRunner?.data && (parentEntityManager.queryRunner?.data as any)[activityNameKey]) {
    container = parentContainer;
  } else {
    container = createActivityContainer(parentContainer, activityName);
  }
  return container;
}

function createActivityContainer(parentContainer: DIContainer, activityName: string) {
  const entityManager: EntityManager = parentContainer.get(EntityManager);
  return (parentContainer as LazyDIContainer).clone([
    {
      provide: EntityManager,
      with: () => {
        const queryRunner = entityManager.connection.createQueryRunner();
        if (!queryRunner.data) {
          queryRunner.data = {};
        }
        (queryRunner.data as any)[activityNameKey] = activityName;
        return entityManager.connection.createEntityManager(queryRunner);
      },
      proxy: false,
    },
  ]);
}
