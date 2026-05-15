import { type Response } from 'express';
import { SessionsService } from './sessions.service';
export declare class SessionsController {
    private readonly sessionsService;
    private readonly logger;
    constructor(sessionsService: SessionsService);
    serveImage(filename: string, res: Response): void;
    getExportData(start: string, end: string): Promise<import("./entities/measurement.entity").Measurement[]>;
    create(files: Array<Express.Multer.File>, dataString: string): Promise<{
        message: string;
        sessionId: string;
        state: string;
    }>;
    findAll(): Promise<any[]>;
    findOne(id: string): Promise<import("./entities/session.entity").Session | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
    update(id: string, files: Array<Express.Multer.File>, dataString: string): Promise<{
        message: string;
        sessionId: string;
        state: string;
        update_count: number;
    }>;
    getReportData(id: string): Promise<any>;
}
