import { VehiculoService } from './vehicle.service.js';
import { CreateVehiculoDto } from './models/create-vehicle.dto.js';
import { UpdateVehiculoDto } from './models/update-vehicle.dto.js';
export declare class VehiculoController {
    private readonly vehiculoService;
    constructor(vehiculoService: VehiculoService);
    create(createVehiculoDto: CreateVehiculoDto): Promise<import("./models/vehicle.entity.js").Vehiculo>;
    findAll(): Promise<import("./models/vehicle.entity.js").Vehiculo[]>;
    findOne(id: number): Promise<import("./models/vehicle.entity.js").Vehiculo>;
    findByPatente(patente: string): Promise<{
        status: string;
        patente: string;
        data?: undefined;
    } | {
        status: string;
        data: import("./models/vehicle.entity.js").Vehiculo;
        patente?: undefined;
    }>;
    update(id: number, updateVehiculoDto: UpdateVehiculoDto): Promise<import("./models/vehicle.entity.js").Vehiculo>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
