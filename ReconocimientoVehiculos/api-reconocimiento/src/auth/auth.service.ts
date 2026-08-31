import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../users/models/user.entity.js';
import { JwtPayload } from './jwt.payload.interface.js';
import { LoginDto } from './models/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private usuarioRepository: Repository<Usuario>,
    private jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<any> {
    const user = await this.usuarioRepository.findOne({
      where: { username: loginDto.username },
    });
    if (user && (await bcrypt.compare(loginDto.password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Usuario inactivo. Contacte al administrador.',
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      rol: user.rol,
      isActive: user.isActive,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
