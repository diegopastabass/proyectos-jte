import { Repository } from 'typeorm';
import { Checklist } from '../entities/checklist.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
export declare class VehiclesService {
    private vehiclesRepository;
    private checklistsRepository;
    private readonly logger;
    constructor(vehiclesRepository: Repository<Vehicle>, checklistsRepository: Repository<Checklist>);
    create(createVehicleDto: CreateVehicleDto): Promise<Vehicle>;
    findAll(): Promise<Vehicle[]>;
    findOne(id: string): Promise<Vehicle>;
    update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle>;
    resetMantencion(id: string): Promise<Vehicle>;
    remove(id: string): Promise<void>;
}
