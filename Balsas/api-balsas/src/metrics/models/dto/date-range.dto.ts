import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { POZOS } from '../../../config/sensores.config';
import type { Pozo } from '../../../config/sensores.config';

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeDto {
  @IsOptional()
  @Matches(DAY_FORMAT, { message: 'start debe tener formato YYYY-MM-DD' })
  start?: string;

  @IsOptional()
  @Matches(DAY_FORMAT, { message: 'end debe tener formato YYYY-MM-DD' })
  end?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

export class PozoQueryDto extends DateRangeDto {
  @IsIn(POZOS, { message: `pozo debe ser uno de: ${POZOS.join(', ')}` })
  pozo!: Pozo;
}

export class VoltajeQueryDto extends PozoQueryDto {
  @IsOptional()
  @IsIn(['fase', 'linea'], { message: 'tipo debe ser fase o linea' })
  tipo?: 'fase' | 'linea';
}
