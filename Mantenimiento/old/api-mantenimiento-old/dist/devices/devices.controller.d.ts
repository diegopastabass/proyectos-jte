import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './create-device.dto';
export declare class DevicesController {
    private readonly service;
    constructor(service: DevicesService);
    create(dto: CreateDeviceDto[] | CreateDeviceDto): Promise<{
        success: boolean;
        insertedIds: number[];
    }>;
    findOne(id: number): Promise<{
        success: boolean;
        message: string;
        device?: undefined;
    } | {
        success: boolean;
        device: import("./devices.entity").Device;
        message?: undefined;
    }>;
    findByMaintenance(maintenanceId: number): Promise<{
        success: boolean;
        devices: import("./devices.entity").Device[];
    }>;
}
