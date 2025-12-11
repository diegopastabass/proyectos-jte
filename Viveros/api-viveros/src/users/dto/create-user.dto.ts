import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  username: string;

  @IsEmail()
  email: string;

  @MinLength(8)
  @Matches(/(?=.*\d)(?=.*[A-Za-z])(?=.*[\W_]).+/, {
    message: 'Password debe tener números, letras y símbolos',
  })
  password: string;

  role?: string;
}
