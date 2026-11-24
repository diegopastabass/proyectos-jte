import { Transform } from 'class-transformer';
import { IsString, IsInt, IsOptional, IsDateString, Matches, Min, Max, MaxLength, MinLength } from 'class-validator';

/** Mayúsculas, sin espacios ni guiones: "ab-cd 12" -> "ABCD12" */
export const normalizePatente = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[\s-]/g, '') : value;

/** Fechas vacías ("") se interpretan como "borrar la fecha" */
export const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

// Autos nuevos AA1234 / BBBB12, motos y similares BBB12
export const PATENTE_REGEX = /^([A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2}|[A-Z]{3}[0-9]{2})$/;

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model: string;

  @Transform(normalizePatente)
  @IsString()
  @Matches(PATENTE_REGEX, { message: 'Formato de patente inválido (ej: ABCD12 o AB1234)' })
  patente: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kilometraje?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  km_ultima_mantencion?: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  fecha_venc_revision_tecnica?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  fecha_venc_circulacion?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  fecha_prox_mantencion?: string | null;
}
