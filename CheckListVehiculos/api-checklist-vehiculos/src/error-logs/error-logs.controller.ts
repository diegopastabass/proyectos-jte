import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ErrorLogsService } from './error-logs.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';

@Controller('error-logs')
export class ErrorLogsController {
  constructor(private readonly errorLogsService: ErrorLogsService) {}

  // Público a propósito (los errores de login también se registran), pero acotado
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post()
  async logError(@Body() body: CreateErrorLogDto) {
    return this.errorLogsService.createErrorLog(body.user_id, body.error, body.timestamp);
  }
}
