import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { ROL_PENDIENTE } from './roles';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }
    // El rol nunca viene del cliente: todo registro nuevo queda pendiente de aprobación.
    await this.usersService.create({ username, email, password, role: ROL_PENDIENTE });
  }

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const matches = await bcrypt.compare(pass, (user as any).password_hash);
    if (matches) {
      const { password_hash, ...result } = user as any;
      return result;
    }
    throw new UnauthorizedException('Credenciales inválidas');
  }

  async login(user: any) {
    if (user.role === ROL_PENDIENTE) {
      throw new ForbiddenException('Tu cuenta aún no está habilitada. Un administrador debe aprobarla.');
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user_role: user.role,
    };
  }
}
