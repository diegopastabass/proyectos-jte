import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLog } from '../entities/error-log.entity';

@Injectable()
export class ErrorLogsService {
  private readonly logger = new Logger(ErrorLogsService.name);

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: Repository<ErrorLog>,
  ) {}

  async createErrorLog(userId: string | undefined, error: string, timestamp?: Date) {
    try {
      const log = this.errorLogRepository.create({
        user_id: userId,
        error: error,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      });
      await this.errorLogRepository.save(log);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to save error log', err);
      return { success: false, message: 'Could not save log' };
    }
  }
}
