import { IsDefined, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  @IsDefined()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;
}
