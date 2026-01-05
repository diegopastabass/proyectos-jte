// create-file.dto.ts
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateFileDto {
  @IsNotEmpty()
  @IsString()
  file_name: string;

  @IsNotEmpty()
  @IsString()
  file_path: string;

  @IsNotEmpty()
  @IsNumber()
  maintenance_id: number;
}
