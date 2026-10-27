import { IsOptional, IsDate, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeDto {
  @IsOptional()
  @Type(() => Date)
  start?: Date;

  @IsOptional()
  @Type(() => Date)
  end?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
