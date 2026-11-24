import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateErrorLogDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsString()
  @MaxLength(4000)
  error: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
