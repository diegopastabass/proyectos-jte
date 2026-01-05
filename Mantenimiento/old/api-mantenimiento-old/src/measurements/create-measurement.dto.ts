// create-measurement.dto.ts
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateMeasurementDto {
  @IsNotEmpty({ message: 'Device ID is required' })
  @IsNumber({}, { message: 'Device ID must be a number' })
  device_id!: number;

  @IsNotEmpty({ message: 'Maintenance ID is required' })
  @IsNumber({}, { message: 'Maintenance ID must be a number' })
  maintenance_id!: number;

  @IsNotEmpty({ message: 'Measurement type is required' })
  @IsString({ message: 'Measurement type must be a string' })
  measurement_type!: string;

  @IsNotEmpty({ message: 'Value is required' })
  @IsNumber({}, { message: 'Value must be a number' })
  value!: number;

  @IsNotEmpty({ message: 'Unit is required' })
  @IsString({ message: 'Unit must be a string' })
  unit!: string;
}
