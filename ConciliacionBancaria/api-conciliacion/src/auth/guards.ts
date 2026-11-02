import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolEmpresa, UsuarioEmpresa } from '../entities';
import {
  CLAVE_PUBLICO,
  CLAVE_ROL_EMPRESA,
  CLAVE_SOLO_ADMIN,
  UsuarioActual,
} from './auth.decorators';

/** Guard global: toda ruta exige JWT salvo las marcadas con @Publico(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    return publico ? true : super.canActivate(ctx);
  }
}

const NIVEL: Record<RolEmpresa, number> = { lector: 1, operador: 2, admin: 3 };

/**
 * Guard global de permisos:
 * - @SoloAdmin(): solo administradores globales.
 * - Rutas con :empresaId: el usuario debe pertenecer a la empresa con el rol mínimo
 *   (@RolMinimo, por defecto 'lector'). El admin global pasa siempre.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UsuarioEmpresa)
    private readonly accesos: Repository<UsuarioEmpresa>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos))
      return true;

    const req = ctx.switchToHttp().getRequest<{
      user: UsuarioActual;
      params?: Record<string, string>;
    }>();
    const usuario = req.user;

    if (
      this.reflector.getAllAndOverride<boolean>(CLAVE_SOLO_ADMIN, objetivos) &&
      !usuario.esAdmin
    ) {
      throw new ForbiddenException('Requiere administrador');
    }

    const empresaId = req.params?.empresaId;
    if (empresaId === undefined || usuario.esAdmin) return true;
    if (!/^\d+$/.test(empresaId))
      throw new NotFoundException('Empresa no encontrada');

    const acceso = await this.accesos.findOneBy({
      usuarioId: usuario.id,
      empresaId: Number(empresaId),
    });
    // 404 y no 403: no se revela si la empresa existe.
    if (!acceso) throw new NotFoundException('Empresa no encontrada');

    const requerido =
      this.reflector.getAllAndOverride<RolEmpresa>(
        CLAVE_ROL_EMPRESA,
        objetivos,
      ) ?? 'lector';
    if (NIVEL[acceso.rol] < NIVEL[requerido]) {
      throw new ForbiddenException(`Requiere rol ${requerido} en la empresa`);
    }
    return true;
  }
}
