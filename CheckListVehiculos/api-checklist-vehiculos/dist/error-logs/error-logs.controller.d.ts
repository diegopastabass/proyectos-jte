import { ErrorLogsService } from './error-logs.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
export declare class ErrorLogsController {
    private readonly errorLogsService;
    constructor(errorLogsService: ErrorLogsService);
    logError(body: CreateErrorLogDto): Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
}
