import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Injectable,
  Module,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Usuario, UsuarioEmpresa } from '../entities';
import {
  Publico,
  type UsuarioActual,
  UsuarioAutenticado,
} from './auth.decorators';
import { JwtAuthGuard, PermisosGuard } from './guards';
import { JwtStrategy } from './jwt.strategy';

class CambiarPasswordDto {
  @IsString() actual: string;
  @IsString() @MinLength(10) nueva: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
  ) {}

  async cambiarPassword(
    usuarioId: number,
    { actual, nueva }: CambiarPasswordDto,
  ) {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.hashPassword')
      .where('u.id = :usuarioId', { usuarioId })
      .getOne();
    if (!usuario || !(await bcrypt.compare(actual, usuario.hashPassword))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (actual === nueva)
      throw new BadRequestException('La contraseña nueva debe ser distinta');
    await this.usuarios.update(
      { id: usuarioId },
      { hashPassword: await bcrypt.hash(nueva, 12) },
    );
    return { ok: true };
  }

  async login({ email, password }: LoginDto) {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.hashPassword')
      .where('lower(u.email) = lower(:email) AND u.activo', { email })
      .getOne();
    if (!usuario || !(await bcrypt.compare(password, usuario.hashPassword))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return {
      access_token: this.jwt.sign({ sub: usuario.id }),
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        esAdmin: usuario.esAdmin,
      },
    };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Patch('password')
  cambiarPassword(
    @Body() dto: CambiarPasswordDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.auth.cambiarPassword(usuario.id, dto);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, UsuarioEmpresa]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Orden importa: primero se autentica, después se revisan permisos.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AuthModule {}
