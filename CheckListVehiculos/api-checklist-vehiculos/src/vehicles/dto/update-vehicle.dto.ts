import { Transform } from 'class-transformer';
import { IsString, IsInt, IsOptional, IsDateString, IsBoolean, Matches, Min, Max, MaxLength, MinLength } from 'class-validator';
import { emptyToNull, normalizePatente, PATENTE_REGEX } from './create-vehicle.dto';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @Transform(normalizePatente)
  @IsString()
  @Matches(PATENTE_REGEX, { message: 'Formato de patente inválido (ej: ABCD12 o AB1234)' })
  patente?: string;

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

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
