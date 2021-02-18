import { EntityManager } from "typeorm";
import { ActivityLog } from "../data/entity/ActivityLog";
import { TransactionLog } from "../data/entity/TransactionLog";

export class AuditPersistenceService {

    async persistTaskTransaction(taskTransaction: TransactionLog, entityManager: EntityManager) {
        if (!taskTransaction.activity.id) {
            await this.persistTaskActivity(taskTransaction.activity, entityManager);
        }

        await entityManager.save(taskTransaction);
    }

    async persistTaskActivity(taskActivity: ActivityLog, entityManager: EntityManager) {
        if (taskActivity.parent) {
            await this.persistTaskActivity(taskActivity.parent, entityManager);
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