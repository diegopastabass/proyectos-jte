import { MaintenancesService } from './maintenances.service';
import { CreateMaintenanceDto } from './create-maintenance.dto';
export declare class MaintenancesController {
    private readonly service;
    constructor(service: MaintenancesService);
    create(user: any, dto: CreateMaintenanceDto): Promise<{
        success: boolean;
        insertedId: number;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
        insertedId?: undefined;
    }>;
    findOne(id: number): Promise<{
        success: boolean;
        message: string;
        maintenance?: undefined;
    } | {
        success: boolean;
        maintenance: import("./maintenances.entity").Maintenance;
        message?: undefined;
    }>;
    findByAdmin(user: any): Promise<{
        success: boolean;
        maintenances: import("./maintenances.entity").Maintenance[];
    }>;
    findByMaintainer(user: any): Promise<{
        success: boolean;
        maintenances: import("./maintenances.entity").Maintenance[];
    }>;
}
