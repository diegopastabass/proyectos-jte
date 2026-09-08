import { IsString, IsInt, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  patente?: string;

  @IsOptional()
  @IsInt()
  kilometraje?: number;

  @IsOptional()
  @IsInt()
  km_ultima_mantencion?: number;

  @IsOptional()
  @IsDateString()
  fecha_venc_revision_tecnica?: string;

  @IsOptional()
  @IsDateString()
  fecha_venc_circulacion?: string;

  @IsOptional()
  @IsDateString()
  fecha_prox_mantencion?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
