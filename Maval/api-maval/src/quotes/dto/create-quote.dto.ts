import { IsNotEmpty, IsObject } from 'class-validator';

export class CreateQuoteDto {
  @IsNotEmpty()
  @IsObject()
  data: any; // Recibe el JSON completo de la cotización
}
