import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../entities';
import { UsuarioActual } from './auth.decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Se relee el usuario en cada request: desactivarlo o quitarle el admin corta el acceso al tiro. */
  async validate(payload: { sub: number }): Promise<UsuarioActual> {
    const usuario = await this.usuarios.findOneBy({
      id: payload.sub,
      activo: true,
    });
    if (!usuario)
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    return { id: usuario.id, email: usuario.email, esAdmin: usuario.esAdmin };
  }
}
