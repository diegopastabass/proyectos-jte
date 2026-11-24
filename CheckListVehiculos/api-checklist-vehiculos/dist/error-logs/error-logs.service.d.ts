import { Repository } from 'typeorm';
import { ErrorLog } from '../entities/error-log.entity';
export declare class ErrorLogsService {
    private readonly errorLogRepository;
    private readonly logger;
    constructor(errorLogRepository: Repository<ErrorLog>);
    createErrorLog(userId: string | undefined, error: string, timestamp?: string): Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
}
