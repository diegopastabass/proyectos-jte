import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from '../users/dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginUserDto: LoginUserDto) {
    // 1. Validamos credenciales usando tu UsersService existente
    const user = await this.usersService.validateUser(loginUserDto);
    
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Creamos el Payload con los datos que pediste
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      fullName: user.full_name // Agregamos el nombre
    };

    // 3. Retornamos el token firmado y datos básicos del usuario
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    };
  }
}