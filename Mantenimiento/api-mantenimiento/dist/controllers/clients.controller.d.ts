import { ClientsService } from '../services/clients.service';
import { CreateClientDto } from '../models/create-client.dto';
export declare class ClientsController {
    private readonly service;
    constructor(service: ClientsService);
    create(dto: CreateClientDto): Promise<{
        success: boolean;
        insertedId: number;
    }>;
    findOne(id: number): Promise<{
        success: boolean;
        message: string;
        client?: undefined;
    } | {
        success: boolean;
        client: import("../models/clients.interface").Client;
        message?: undefined;
    }>;
}
