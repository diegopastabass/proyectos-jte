import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  ticketNumber: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsObject()
  data: any; // El objeto JSON completo del formulario
  
  // Nota: El ID del usuario creador usualmente se obtiene del token/session, no se envía en el body por seguridad.
}