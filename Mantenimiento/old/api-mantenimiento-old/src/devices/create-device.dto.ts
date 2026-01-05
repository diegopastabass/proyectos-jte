// create-device.dto.ts
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty({ message: 'El ID del mantenimiento es obligatorio' })
  @IsNumber({}, { message: 'El ID del mantenimiento debe ser un número' })
  maintenance_id: number;

  @IsNotEmpty({ message: 'El tipo de dispositivo es obligatorio' })
  @IsString({ message: 'El tipo de dispositivo debe ser un texto' })
  device_type: string;

  @IsString({ message: 'El número de serie debe ser un texto' })
  serial_number: string;

  @IsNotEmpty({ message: 'El modelo es obligatorio' })
  @IsString({ message: 'El modelo debe ser un texto' })
  model: string;
}
