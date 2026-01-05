import { Repository } from 'typeorm';
import { CreateDeviceDto } from './create-device.dto';
import { Device } from './devices.entity';
export declare class DevicesService {
    private deviceRepository;
    constructor(deviceRepository: Repository<Device>);
    create(dtos: CreateDeviceDto[]): Promise<number[]>;
    find(id: number): Promise<Device>;
    findByMaintenance(maintenanceId: number): Promise<Device[]>;
}
