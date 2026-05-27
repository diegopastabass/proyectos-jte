import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Response shape returned by the TransformInterceptor.
 */
export interface TransformResponse<T> {
  data: T;
  statusCode: number;
  message: string;
}

/**
 * Interceptor that wraps all successful responses in a standardized
 * envelope: { data, statusCode, message }.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((data) => ({
        data,
        statusCode,
        message: 'Success',
      })),
    );
  }
}
