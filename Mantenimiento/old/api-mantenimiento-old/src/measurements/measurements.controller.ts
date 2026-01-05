// measurements.controller.ts
import { Body, Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './create-measurement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'maintainer')
  @Post()
  async create(@Body() createMeasurementDto: CreateMeasurementDto) {
    return this.measurementsService.create(createMeasurementDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('maintenance/:id')
  async findByMaintenance(@Param('id') id: number) {
    return this.measurementsService.findByMaintenance(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('device/:id')
  async findByDevice(@Param('id') id: number) {
    return this.measurementsService.findByDevice(id);
  }
}
