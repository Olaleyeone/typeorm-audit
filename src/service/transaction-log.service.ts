import { EntityManager } from 'typeorm';
import { ActivityLog } from '../data/entity/ActivityLog';
import { TransactionLog } from '../data/entity/TransactionLog';

export class TransactionLogService {
  async saveTransactionLog(taskTransaction: TransactionLog, entityManager: EntityManager) {
    if (!taskTransaction.activity.id) {
      await this.saveActivityLog(taskTransaction.activity, entityManager);
    }
    await entityManager.save(taskTransaction);
  }

  async saveActivityLog(taskActivity: ActivityLog, entityManager: EntityManager) {
    if (taskActivity.parent) {
      await this.saveActivityLog(taskActivity.parent, entityManager);
    }
    if (taskActivity.id) {
      const existing = await entityManager.findOne(ActivityLog, taskActivity.id);
      if (existing) {
        await entityManager.save(taskActivity);
        return;
      }
      delete taskActivity.id;
    }
    await entityManager.save(taskActivity);
  }
}
