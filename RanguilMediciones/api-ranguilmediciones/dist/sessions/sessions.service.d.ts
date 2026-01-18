import { Repository, DataSource } from 'typeorm';
import { Session } from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
export declare class SessionsService {
    private readonly sessionRepo;
    private readonly dataSource;
    constructor(sessionRepo: Repository<Session>, dataSource: DataSource);
    createFullSession(data: CreateSessionDto, files: Array<Express.Multer.File>): Promise<{
        message: string;
        sessionId: string;
    }>;
    findAll(): Promise<Session[]>;
    findOne(id: string): Promise<Session | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
