import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { RolEmpresa } from '../entities';

/** Usuario autenticado, tal como lo deja JwtStrategy.validate en request.user. */
export interface UsuarioActual {
  id: number;
  email: string;
  esAdmin: boolean;
}

export const CLAVE_PUBLICO = 'publico';
/** Ruta sin JWT (solo el login). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

export const CLAVE_SOLO_ADMIN = 'soloAdmin';
/** Solo administradores globales (crear usuarios y empresas). */
export const SoloAdmin = () => SetMetadata(CLAVE_SOLO_ADMIN, true);

export const CLAVE_ROL_EMPRESA = 'rolEmpresa';
/**
 * Rol mínimo en la empresa de la ruta (:empresaId). Jerarquía: lector < operador < admin.
 * Sin este decorador, las rutas con :empresaId exigen al menos 'lector'.
 */
export const RolMinimo = (rol: RolEmpresa) =>
  SetMetadata(CLAVE_ROL_EMPRESA, rol);

export const UsuarioAutenticado = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual =>
    ctx.switchToHttp().getRequest<{ user: UsuarioActual }>().user,
);
