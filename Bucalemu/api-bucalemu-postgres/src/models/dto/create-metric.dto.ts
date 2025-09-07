import { IsString, IsNumber } from 'class-validator';

export class CreateMetricDto {
  @IsString()
  mt_name: string;

  @IsNumber()
  mt_value: number;
}
