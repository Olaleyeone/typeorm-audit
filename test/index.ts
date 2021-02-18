import "reflect-metadata";
import { Connection, createConnection, EntityManager } from "typeorm";
import { ActivityLog } from "../src/data/entity/ActivityLog";
import { EntityManagerFactory } from "../src/service/entity-manager.factory";
import { Address } from "./entity/Address";
import { User } from "./entity/User";
import { LazyDIContainer, ConstructorFunction, Provider } from 'di-node';
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

        // const parentActivity = new ActivityLog('TEST ACTIVITY LOG');

        // const entityManagerFactory = new EntityManagerFactory(connection);
        // // console.log("Inserting a new user into the database...");

        // const insertActivity = new ActivityLog('SAVE USER');
        // insertActivity.parentActivity = parentActivity;
        // const savedUser = await entityManagerFactory.forActivity(insertActivity, async entityManager => {
        //     const address = new Address();
        //     address.country = 'USA';
        //     address.city = 'California';
        //     address.district = 'Mountain View';
        //     address.streetName = 'Amphitheatre Parkway';
        //     address.houseNumber = '1600';
        //     await entityManager.save(address);

        //     const user = new User();
        //     user.name.firstName = "Timber";
        //     user.name.lastName = "Saw";
        //     user.age = 25;
        //     user.address = address;
        //     return entityManager.save(user);
        // });

        // console.log("Saved a new user with id: " + savedUser.id);

        // const updateActivity = new ActivityLog('UPDATE USER');
        // updateActivity.parentActivity = parentActivity;
        // await entityManagerFactory.forActivity(updateActivity, entityManager => {
        //     const user = savedUser;
        //     user.name.firstName = "Usain";
        //     user.name.lastName = "Bolt";
        //     user.age = 31;
        //     return entityManager.save(user);
        // });

        // const deleteActivity = new ActivityLog('DELETE USER');
        // deleteActivity.parentActivity = parentActivity;
        // await entityManagerFactory.forActivity(deleteActivity, entityManager => {
        //     return entityManager.remove(savedUser);
        // });

        // console.log("Here you can setup and run express/koa/any other framework.");

    }).catch(error => console.log(error));
});
