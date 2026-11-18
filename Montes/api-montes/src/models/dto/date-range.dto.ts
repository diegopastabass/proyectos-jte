import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeDto {
  @IsOptional()
  @Matches(FORMATO_DIA, { message: 'start debe tener formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'start no es una fecha válida' })
  start?: string;

  @IsOptional()
  @Matches(FORMATO_DIA, { message: 'end debe tener formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'end no es una fecha válida' })
  end?: string;
}

export class MesesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  meses?: number;
}
