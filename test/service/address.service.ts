import { EntityManager } from "typeorm";
import { Address } from "../entity/Address";
import { Injectable } from 'di-node';
import { Activity } from '../../src/decorator/activity';

@Injectable()
export class AddressService {

    constructor(private entityManager: EntityManager) {
    }

    @Activity('SAVE ADDRESS')
    async saveAddress(): Promise<Address> {
        const address = new Address();
        address.country = 'USA';
        address.city = 'California';
        address.district = 'Mountain View';
        address.streetName = 'Amphitheatre Parkway';
        address.houseNumber = '1600';
        await this.entityManager.save(address);
        return address;
    }
}