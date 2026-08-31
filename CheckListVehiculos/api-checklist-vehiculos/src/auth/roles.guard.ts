import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireAdmin = this.reflector.get<boolean>('isAdmin', context.getHandler());
    if (!requireAdmin) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return user && user.is_admin === true;
  }
}
