import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class QueryChecklistsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Búsqueda parcial por patente */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Za-z0-9 -]*$/)
  patente?: string;

  @IsOptional()
  @IsUUID()
  vehicle_id?: string;

  /** YYYY-MM-DD, día de Chile */
  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  hasta?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  has_issues?: boolean;
}
