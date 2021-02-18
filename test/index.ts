import "reflect-metadata";
import { createConnection, EntityManager } from "typeorm";
import { LazyDIContainer } from '@olaleyeone/di-node';
import { UserService } from "./service/user.service";
import { createActivityLogProxy } from "../src/di/transactional-proxy-factory";

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
            const user = await userService.saveUser();

            console.log('user:', user);

        }).catch(error => console.log(error));
});
