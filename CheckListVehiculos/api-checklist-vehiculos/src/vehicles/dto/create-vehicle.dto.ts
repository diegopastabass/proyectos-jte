import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  model: string;

  @IsString()
  patente: string;

  @IsOptional()
  @IsInt()
  kilometraje?: number;

  @IsOptional()
  @IsInt()
  km_desde_ultima_mantencion?: number;

  @IsOptional()
  @IsDateString()
  fecha_venc_revision_tecnica?: string;

  @IsOptional()
  @IsDateString()
  fecha_venc_circulacion?: string;

  @IsOptional()
  @IsDateString()
  fecha_prox_mantencion?: string;
}
