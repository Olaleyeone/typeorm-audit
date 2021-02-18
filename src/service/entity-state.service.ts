import { EntityManager, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { OperationType } from '../data/enum/operation-type.enum';
import { TransactionLogService } from './transaction-log.service';
import { ActivityLog } from '../data/entity/ActivityLog';
import { CodeContext } from '../data/entity/CodeContext';
import { EntityState } from '../data/entity/EntityState';
import { EntityStateAttribute } from '../data/entity/EntityStateAttribute';
import { TransactionLog } from '../data/entity/TransactionLog';
import { WebRequest } from '../data/entity/WebRequest';

const transactionKey = Symbol('transaction');

export function getTransactionLog(entityManager: EntityManager): TransactionLog {
  return (entityManager.queryRunner as any)[transactionKey];
}

export function setTransactionLog(entityManager: EntityManager, transactionLog: TransactionLog) {
  (entityManager.queryRunner as any)[transactionKey] = transactionLog;
}

export class EntityStateService {
  constructor(private transactionLogService: TransactionLogService) {}

  async saveEntityState(
    event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>,
    operationType: OperationType,
    id?: any,
  ) {
    const entityState: EntityState = new EntityState();
    entityState.operationType = operationType;
    entityState.entityName = event.metadata.name;
    entityState.entityId = JSON.stringify(id || event.manager.getId(event.entity));

    const taskTransaction: TransactionLog = getTransactionLog(event.manager);
    if (!taskTransaction) {
      throw new Error('Data modification must occur with a defined activity');
    }
    if (!taskTransaction.id) {
      await this.transactionLogService.saveTransactionLog(taskTransaction, event.manager);
    }
    entityState.transaction = taskTransaction;
    await event.manager.save(entityState);
    return entityState;
  }

  isAuditEntity(event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>) {
    const classes: Array<Function | string> = [
      WebRequest,
      ActivityLog,
      TransactionLog,
      CodeContext,
      EntityState,
      EntityStateAttribute,
    ];
    return classes.includes(event.metadata.target);
  }
}
