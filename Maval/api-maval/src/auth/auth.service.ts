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
    try {
      // 1. Validamos credenciales usando tu UsersService existente
      const user = await this.usersService.validateUser(loginUserDto);

      if (!user) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      console.log(error);
    }
  }
}
