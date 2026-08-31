import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiculoService } from './vehicle.service.js';
import { VehiculoController } from './vehicle.controller.js';
import { Vehiculo } from './models/vehicle.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Vehiculo])],
  controllers: [VehiculoController],
  providers: [VehiculoService],
  exports: [VehiculoService],
})
export class VehiclesModule {}
