import { Repository } from 'typeorm';
import { CreateClientDto } from '../clients/create-client.dto';
import { Client } from './clients.entity';
export declare class ClientsService {
    private clientesRepo;
    constructor(clientesRepo: Repository<Client>);
    create(dto: CreateClientDto): Promise<number>;
    find(id: number): Promise<Client | null>;
    findAll(): Promise<{
        id: number;
        name: string;
    }[]>;
}
