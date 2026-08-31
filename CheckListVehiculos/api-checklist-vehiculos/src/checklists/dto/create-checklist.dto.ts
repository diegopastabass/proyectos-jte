import { IsString, IsInt, IsBoolean, IsOptional, IsObject } from 'class-validator';

export class CreateChecklistDto {
  @IsString()
  vehicle_id: string;

  @IsInt()
  kilometraje_actual: number;

  @IsObject()
  visual_checks: any;

  @IsObject()
  mechanical_checks: any;

  @IsOptional()
  @IsString()
  observaciones_generales?: string;

  @IsBoolean()
  has_issues: boolean;
}
