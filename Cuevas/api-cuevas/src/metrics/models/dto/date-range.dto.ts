import { IsOptional, Matches } from 'class-validator';

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeDto {
  @IsOptional()
  @Matches(DAY_FORMAT, { message: 'start debe tener formato YYYY-MM-DD' })
  start?: string;

  @IsOptional()
  @Matches(DAY_FORMAT, { message: 'end debe tener formato YYYY-MM-DD' })
  end?: string;

  @IsOptional()
  limit?: number | string;
}
