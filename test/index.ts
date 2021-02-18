import "reflect-metadata";
import { Connection, createConnection, EntityManager } from "typeorm";
import { LazyDIContainer } from '@olaleyeone/di-node';
import { UserService } from "./service/user.service";
import { AddressService } from "./service/address.service";
import { createActivityLogProxy } from "../src/proxy/activity-log-proxy-factory";

import('./conf/ormconfig').then(m => {
    createConnection(m.config).then(async connection => {

        const container = new LazyDIContainer({
            providers: [
                UserService,
                AddressService,
                {
                    provide: Connection,
                    with: () => connection,
                    proxy: false
                },
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
