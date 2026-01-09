import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateReportDto {

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsObject()
  data: any; 
}