// create-user.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Password hash must be a string' })
  @IsNotEmpty({ message: 'Password hash is required' })
  password!: string;

  @IsString({ message: 'Role must be a string' })
  @IsNotEmpty({ message: 'Role is required' })
  role!: string;
}
