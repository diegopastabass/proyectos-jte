import { SessionsService } from './sessions.service';
export declare class SessionsController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    create(files: Array<Express.Multer.File>, dataString: string): Promise<{
        message: string;
        sessionId: string;
    }>;
    findAll(): Promise<import("./entities/session.entity").Session[]>;
    findOne(id: string): Promise<import("./entities/session.entity").Session | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
