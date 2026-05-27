import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that extends Passport's JWT AuthGuard.
 * Protects routes by requiring a valid JWT token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
