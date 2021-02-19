import { LazyDIContainer } from '@olaleyeone/di-node';
import "reflect-metadata";
import { createConnection, EntityManager } from "typeorm";
import { ActivityLogProxyFactory } from "../src/di/activity-log-proxy-factory";
import { User } from './entity/User';
import { UserService } from "./service/user.service";

import('./conf/ormconfig').then(m => {
    createConnection(m.config)
        .then(async connection => {

            const container = new LazyDIContainer({
                providers: [
                    {
                        provide: EntityManager,
                        with: () => connection.manager,
                        proxy: false
                    }
                ],
                proxyFactory: ActivityLogProxyFactory
            });

            const userService = container.getInstance(UserService);
            Promise.all([
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser(),
                userService.saveUser()
            ]).then((users: User[]) => {
                console.log(`${users.length} users created!!!`);
            });

        }).catch(error => console.log(error));
});
