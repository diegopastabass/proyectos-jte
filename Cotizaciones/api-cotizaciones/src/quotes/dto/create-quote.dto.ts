import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateQuoteDto {
  @IsNotEmpty()
  @IsString()
  clientName: string;

  @IsNotEmpty()
  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
