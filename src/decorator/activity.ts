import 'reflect-metadata';

const metadataKey = Symbol('activity');
Activity.metadataKey = metadataKey;

export function Activity(name: string) {
  if (!name || /^ *$/.test(name)) {
    throw new Error('Invalid activity name');
  }
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(metadataKey, name, target.constructor, propertyKey);
  };
}