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

/** Rutas antiguas (totalizador-1, -2, -piscina): mismos nombres de parámetro que antes. */
export class LegacyDateRangeDto {
  @Matches(FORMATO_DIA, { message: 'startDate debe tener formato AAAA-MM-DD' })
  @IsDateString(
    { strict: true },
    { message: 'startDate no es una fecha válida' },
  )
  startDate: string;

  @Matches(FORMATO_DIA, { message: 'endDate debe tener formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'endDate no es una fecha válida' })
  endDate: string;
}

export class MesesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  meses?: number;
}
