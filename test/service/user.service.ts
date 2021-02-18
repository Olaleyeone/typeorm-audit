import { EntityManager } from "typeorm";
import { User } from "../entity/User";
import { AddressService } from "./address.service";
import { Injectable } from 'di-node';
import { Activity } from '../../src/decorator/activity';

@Injectable()
export class UserService {

    constructor(
        private entityManager: EntityManager,
        private addressService: AddressService) {
    }

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