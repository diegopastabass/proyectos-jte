import { IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMetricDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  sensor_id: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  value: number;
}
