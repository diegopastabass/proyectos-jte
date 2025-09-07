// create-client.dto.ts
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class CreateClientDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email: string;

  @Matches(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, { message: 'El RUT no es válido' })
  rut: string;
}
