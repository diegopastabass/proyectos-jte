import { Repository } from 'typeorm';
import { CreateMaintenanceDto } from './create-maintenance.dto';
import { Maintenance } from './maintenances.entity';
export declare class MaintenancesService {
    private readonly maintenanceRepository;
    constructor(maintenanceRepository: Repository<Maintenance>);
    create(dto: CreateMaintenanceDto): Promise<number>;
    find(id: number): Promise<Maintenance | null>;
    findByAdmin(admin_id: number): Promise<Maintenance[]>;
    findByMaintainer(maintainer_id: number): Promise<Maintenance[]>;
}
