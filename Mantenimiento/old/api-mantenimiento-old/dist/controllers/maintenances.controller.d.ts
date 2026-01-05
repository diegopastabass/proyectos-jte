import { MaintenancesService } from '../services/maintenances.service';
import { CreateMaintenanceDto } from '../models/create-maintenance.dto';
export declare class MaintenancesController {
    private readonly service;
    constructor(service: MaintenancesService);
    create(dto: CreateMaintenanceDto): Promise<{
        success: boolean;
        insertedId: number;
    }>;
    findOne(id: number): Promise<{
        success: boolean;
        message: string;
        maintenance?: undefined;
    } | {
        success: boolean;
        maintenance: import("../models/maintenances.interface").Maintenance;
        message?: undefined;
    }>;
}
