import { IsNotEmpty, IsObject, IsString, IsOptional } from 'class-validator';

export class CreateReportDto {

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsObject()
  data: any; 

  @IsString()
  @IsOptional()
  createdAt?: string;
}