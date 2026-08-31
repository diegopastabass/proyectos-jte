import { IsOptional, IsString, IsBoolean, IsObject } from 'class-validator';

export class UpdateChecklistDto {
  @IsOptional()
  @IsObject()
  visual_checks?: any;

  @IsOptional()
  @IsObject()
  mechanical_checks?: any;

  @IsOptional()
  @IsString()
  observaciones_generales?: string;

  @IsOptional()
  @IsBoolean()
  has_issues?: boolean;
}
