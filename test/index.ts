import { LazyDIContainer } from '@olaleyeone/di-node';
import "reflect-metadata";
import { createConnection, EntityManager } from "typeorm";
import { createActivityLogProxy } from "../src/di/transactional-proxy-factory";
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
                proxyFactory: createActivityLogProxy
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
            ]);

        }).catch(error => console.log(error));
});
