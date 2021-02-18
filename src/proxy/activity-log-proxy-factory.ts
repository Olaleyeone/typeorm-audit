import { Activity } from '../decorator/activity';
import { DIContainer, ConstructorFunction, Provider } from '@olaleyeone/di-node';
import { Transactional } from '../decorator/transactional';
import { createActivityRunner } from './activity-runner';
import { createTransactionRunner } from './transactional-runner';

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
          return propertyValue = createActivityRunner(container, constructor, propertyName);
        }

        const transactional: string = Reflect.getMetadata(Transactional.metadataKey, constructor, propertyName);
        if (transactional) {
          return propertyValue = createTransactionRunner(container, constructor, propertyName);
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