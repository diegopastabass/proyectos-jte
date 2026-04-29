import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (user && user.role === '1') {
      return true;
    }
    
    throw new ForbiddenException('No tienes permisos de administrador para realizar esta acción');
  }
}