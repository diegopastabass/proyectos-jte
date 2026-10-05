import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Logger } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  private readonly logger = new Logger(VehiclesController.name);

  constructor(private readonly vehiclesService: VehiclesService) {}

  @UseGuards(RolesGuard)
  @Roles(true)
  @Post()
  async create(@Body() createVehicleDto: CreateVehicleDto) {
    try {
      return await this.vehiclesService.create(createVehicleDto);
    } catch (error) {
      this.logger.error(`Error creating vehicle: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get()
  async findAll() {
    try {
      return await this.vehiclesService.findAll();
    } catch (error) {
      this.logger.error(`Error finding all vehicles: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.vehiclesService.findOne(id);
    } catch (error) {
      this.logger.error(`Error finding vehicle ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @UseGuards(RolesGuard)
  @Roles(true)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateVehicleDto: UpdateVehicleDto) {
    try {
      return await this.vehiclesService.update(id, updateVehicleDto);
    } catch (error) {
      this.logger.error(`Error updating vehicle ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @UseGuards(RolesGuard)
  @Roles(true)
  @Patch(':id/reset-mantencion')
  async resetMantencion(@Param('id') id: string) {
    try {
      return await this.vehiclesService.resetMantencion(id);
    } catch (error) {
      this.logger.error(`Error resetting mantencion for vehicle ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @UseGuards(RolesGuard)
  @Roles(true)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.vehiclesService.remove(id);
    } catch (error) {
      this.logger.error(`Error removing vehicle ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
