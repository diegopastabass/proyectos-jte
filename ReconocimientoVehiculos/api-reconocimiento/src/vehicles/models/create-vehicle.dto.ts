import { IsString, IsNotEmpty, MaxLength, IsNumber } from 'class-validator';

export class CreateVehiculoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  patente: string;

  @IsNumber()
  @IsNotEmpty()
  personaId: number;
}
