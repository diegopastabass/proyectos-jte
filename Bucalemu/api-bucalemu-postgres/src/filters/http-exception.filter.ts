import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = exception.getResponse();
      this.logger.error(`HTTP Error: ${JSON.stringify(message)}`);
      response.status(status).json({ error: message });
    } else {
      this.logger.error(`Unexpected error: ${JSON.stringify(exception)}`);
      response.status(500).json({ error: 'Internal server error' });
    }
  }
}
