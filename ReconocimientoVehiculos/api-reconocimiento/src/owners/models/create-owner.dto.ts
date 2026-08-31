import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePersonaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}
