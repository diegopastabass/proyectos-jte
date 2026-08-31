import { PartialType } from '@nestjs/mapped-types';
import { CreateVehiculoDto } from './create-vehicle.dto.js';

export class UpdateVehiculoDto extends PartialType(CreateVehiculoDto) {}
