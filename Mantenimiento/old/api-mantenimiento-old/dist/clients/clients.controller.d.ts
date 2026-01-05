import { ClientsService } from './clients.service';
import { CreateClientDto } from './create-client.dto';
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
        client: import("./clients.entity").Client;
        message?: undefined;
    }>;
    findAllClients(): Promise<{
        success: boolean;
        clients: {
            id: number;
            name: string;
        }[];
    }>;
}
