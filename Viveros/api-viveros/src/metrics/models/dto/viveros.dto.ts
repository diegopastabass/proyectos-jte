import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { VARIABLES, ZONAS_IDS } from '../../viveros.config';
import type { Variable, ZonaId } from '../../viveros.config';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MENSAJE_DIA = 'debe tener el formato AAAA-MM-DD';

/** Rango de días en hora Chile; `end` inclusivo. */
export class RangoDto {
  @Matches(DIA, { message: `start ${MENSAJE_DIA}` })
  start: string;

  @Matches(DIA, { message: `end ${MENSAJE_DIA}` })
  end: string;
}

export class RangoOpcionalDto {
  @IsOptional()
  @Matches(DIA, { message: `start ${MENSAJE_DIA}` })
  start?: string;

  @IsOptional()
  @Matches(DIA, { message: `end ${MENSAJE_DIA}` })
  end?: string;
}

export class SerieDto extends RangoOpcionalDto {
  @IsIn(ZONAS_IDS)
  zona: ZonaId;

  /** Últimas N horas (alternativa a start/end). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  horas?: number;
}

export class HorarioDto extends RangoDto {
  @IsIn(ZONAS_IDS)
  zona: ZonaId;
}

export class EpisodiosDto extends RangoDto {
  @IsOptional()
  @IsIn(ZONAS_IDS)
  zona?: ZonaId;
}

/** Rango con los nombres antiguos (`startDate`/`endDate`) de `summary` y `data`. */
export class RangoAntiguoDto {
  @Matches(DIA, { message: `startDate ${MENSAJE_DIA}` })
  startDate: string;

  @Matches(DIA, { message: `endDate ${MENSAJE_DIA}` })
  endDate: string;
}

export class DiaDto {
  @Matches(DIA, { message: `date ${MENSAJE_DIA}` })
  date: string;
}

export class UmbralDto {
  @IsIn(ZONAS_IDS)
  zona: ZonaId;

  @IsIn(VARIABLES)
  variable: Variable;

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  min: number | null;

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  max: number | null;

  @IsBoolean()
  alerta: boolean;
}

export class ActualizarUmbralesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UmbralDto)
  umbrales: UmbralDto[];
}
