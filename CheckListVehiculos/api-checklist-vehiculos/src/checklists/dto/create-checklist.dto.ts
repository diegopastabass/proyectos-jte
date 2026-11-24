import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateChecklistDto {
  @IsUUID()
  vehicle_id: string;

  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kilometraje_actual: number;

  @IsObject()
  visual_checks: Record<string, any>;

  @IsObject()
  mechanical_checks: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones_generales?: string;

  // Informativo: el servidor lo recalcula a partir de los ítems
  @IsOptional()
  @IsBoolean()
  has_issues?: boolean;
}
