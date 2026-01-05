import { DatabaseConfig } from '../config/database.config';
import { CreateClientDto } from '../models/create-client.dto';
import { Client } from '../models/clients.interface';
export declare class ClientsService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    create(dto: CreateClientDto): Promise<number>;
    find(id: number): Promise<Client | null>;
}
