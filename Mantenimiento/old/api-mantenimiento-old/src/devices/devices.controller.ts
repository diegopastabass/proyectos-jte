import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './create-device.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'maintainer')
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateDeviceDto[] | CreateDeviceDto) {
    const dtos = Array.isArray(dto) ? dto : [dto];
    const insertedIds = await this.service.create(dtos);
    return { success: true, insertedIds };
  }

  @UseGuards(JwtAuthGuard)
  @Get('find/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const device = await this.service.find(id);
    if (!device) {
      return { success: false, message: 'Device not found' };
    }
    return { success: true, device };
  }

  @UseGuards(JwtAuthGuard)
  @Get('maintenance/:maintenanceId')
  async findByMaintenance(
    @Param('maintenanceId', ParseIntPipe) maintenanceId: number,
  ) {
    const devices = await this.service.findByMaintenance(maintenanceId);
    return { success: true, devices };
  }
}
