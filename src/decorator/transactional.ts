import 'reflect-metadata';

const metadataKey = Symbol('transactional');
Transactional.metadataKey = metadataKey;

export function Transactional() {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(metadataKey, true, target.constructor, propertyKey);
  };
}
