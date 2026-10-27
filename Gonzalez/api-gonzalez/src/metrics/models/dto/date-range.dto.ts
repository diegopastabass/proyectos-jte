import { IsDateString, IsOptional } from 'class-validator';

export class DateRangeDto {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;

  @IsOptional()
  limit?: number | string;
}
