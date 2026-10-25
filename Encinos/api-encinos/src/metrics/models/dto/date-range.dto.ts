import { IsDateString } from 'class-validator';

export class DateRangeDto {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;
}
