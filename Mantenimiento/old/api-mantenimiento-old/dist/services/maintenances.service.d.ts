import { DatabaseConfig } from '../config/database.config';
import { CreateMaintenanceDto } from '../models/create-maintenance.dto';
import { Maintenance } from '../models/maintenances.interface';
export declare class MaintenancesService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    create(dto: CreateMaintenanceDto): Promise<number>;
    find(id: number): Promise<Maintenance | null>;
}
