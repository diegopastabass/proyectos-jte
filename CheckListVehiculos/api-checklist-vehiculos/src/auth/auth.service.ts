import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (user && await bcrypt.compare(pass, user.password_hash)) {
        if (!user.is_active) {
          throw new UnauthorizedException('User account is inactive. Please contact administrator.');
        }
        const { password_hash, ...result } = user;
        return result;
      }
      return null;
    } catch (error) {
      this.logger.error(`Error in validateUser: ${error.message}`, error.stack);
      throw error;
    }
  }

  async login(user: any) {
    try {
      const payload = { email: user.email, sub: user.id, is_admin: user.is_admin };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: user.is_admin
        }
      };
    } catch (error) {
      this.logger.error(`Error in login: ${error.message}`, error.stack);
      throw error;
    }
  }
}
