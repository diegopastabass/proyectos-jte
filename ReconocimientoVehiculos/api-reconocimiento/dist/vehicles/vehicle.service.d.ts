import { Repository } from 'typeorm';
import { Vehiculo } from './models/vehicle.entity.js';
import { CreateVehiculoDto } from './models/create-vehicle.dto.js';
import { UpdateVehiculoDto } from './models/update-vehicle.dto.js';
export declare class VehiculoService {
    private readonly vehiculoRepository;
    private readonly logger;
    constructor(vehiculoRepository: Repository<Vehiculo>);
    create(createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo>;
    findAll(): Promise<Vehiculo[]>;
    findOne(id: number): Promise<Vehiculo>;
    findByPatente(patente: string): Promise<Vehiculo | null>;
    update(id: number, updateVehiculoDto: UpdateVehiculoDto): Promise<Vehiculo>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
