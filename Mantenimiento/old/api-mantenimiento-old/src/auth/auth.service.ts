// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password_hash'> | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const passwordMatch = await bcrypt.compare(pass, user.password_hash);

    if (!passwordMatch) {
      return null;
    }

    const { password_hash, ...result } = user;
    return result;
  }

  async login(user: User) {
    const payload = { id: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      id: user.id,
    };
  }

  async authenticate(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.login(user as User);
  }
}
