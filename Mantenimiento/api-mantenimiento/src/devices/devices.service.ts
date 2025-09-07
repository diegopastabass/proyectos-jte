import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDeviceDto } from './create-device.dto';
import { Device } from './devices.entity';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}
  async create(dtos: CreateDeviceDto[]): Promise<number[]> {
    try {
      const devices = this.deviceRepository.create(dtos);
      await this.deviceRepository.save(devices);

      return devices.map((d) => d.id);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Duplicate entry for serial number');
      }
      throw new InternalServerErrorException(
        `Error creating devices: ${error.message}`,
      );
    }
  }

  async find(id: number): Promise<Device> {
    try {
      const device = await this.deviceRepository.findOne({ where: { id } });
      if (!device) {
        throw new NotFoundException(`Device with id ${id} not found`);
      }
      return device;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error finding device: ${error.message}`,
      );
    }
  }

  async findByMaintenance(maintenanceId: number): Promise<Device[]> {
    try {
      const devices = await this.deviceRepository.find({
        where: { maintenance_id: maintenanceId },
      });
      return devices;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error finding devices by maintenance: ${error.message}`,
      );
    }
  }
}
