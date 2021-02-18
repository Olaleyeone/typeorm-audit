import { EntityManager } from "typeorm";
import { User } from "../entity/User";
import { AddressService } from "./address.service";
import { Injectable } from '@olaleyeone/di-node';
import { Activity } from '../../src/decorator/activity';
import { Transactional } from '../../src/decorator/transactional';

@Injectable()
export class UserService {

    constructor(
        private entityManager: EntityManager,
        private addressService: AddressService) {
    }

    @Transactional()
    @Activity('SAVE USER')
    async saveUser(): Promise<User> {
        const user = new User();
        user.name.firstName = "Timber";
        user.name.lastName = "Saw";
        user.age = 25;
        user.address = await this.addressService.saveAddress();
        await this.entityManager.save(user);
        return user;
    }
}