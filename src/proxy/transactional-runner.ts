import { DIContainer, LazyDIContainer, ConstructorFunction } from '@olaleyeone/di-node';
import { EntityManager } from 'typeorm';

export const runnerKey = Symbol('transaction:entityManager');

export function createTransactionRunner(parentContainer: DIContainer, constructor: ConstructorFunction<any>, methodName: string) {

  const entityManager: EntityManager = parentContainer.get(EntityManager);

  return () => {
    let runner = (parentContainer as any)[runnerKey];
    if (runner) {
      const realTarget: any = parentContainer.createInstance(constructor);
      return realTarget[methodName].call(realTarget, arguments);
    }
    return entityManager.transaction(em => {
      const container = createTransactionalContainer(parentContainer, em);
      (container as any)[runnerKey] = em;

      const realTarget: any = container.createInstance(constructor);
      return realTarget[methodName].call(realTarget, arguments);
    });
  };
}

function createTransactionalContainer(parentContainer: DIContainer, entityManager: EntityManager) {
  return new LazyDIContainer({
    providers: [
      {
        provide: EntityManager,
        with: () => entityManager,
        proxy: false
      }
    ]
  }, parentContainer);
}