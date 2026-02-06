import { IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeDto {
  @IsOptional()
  @Type(() => Date)
  start?: Date;

  @IsOptional()
  @Type(() => Date)
  end?: Date;
}
