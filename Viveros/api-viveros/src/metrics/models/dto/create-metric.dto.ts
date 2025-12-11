import { IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMetricDto {
  @IsString()
  sensor_id: string;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @Type(() => Number)
  @IsNumber()
  value: number;
}
