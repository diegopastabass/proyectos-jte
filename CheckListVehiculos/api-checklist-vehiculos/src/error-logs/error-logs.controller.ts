import { Controller, Post, Body } from '@nestjs/common';
import { ErrorLogsService } from './error-logs.service';

@Controller('error-logs')
export class ErrorLogsController {
  constructor(private readonly errorLogsService: ErrorLogsService) {}

  @Post()
  async logError(@Body() body: { user_id?: string; error: string; timestamp?: Date }) {
    return this.errorLogsService.createErrorLog(body.user_id, body.error, body.timestamp);
  }
}
