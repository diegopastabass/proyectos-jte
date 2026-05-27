import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateTagDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'El color debe ser un código hex válido (ej: #FF5733)',
  })
  color?: string;
}
