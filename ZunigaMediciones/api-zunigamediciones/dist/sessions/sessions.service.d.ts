import { Repository, DataSource } from 'typeorm';
import { Session } from './entities/session.entity';
import { Measurement } from './entities/measurement.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
export declare class SessionsService {
    private readonly sessionRepo;
    private readonly dataSource;
    constructor(sessionRepo: Repository<Session>, dataSource: DataSource);
    getStaticFile(filename: string): string;
    createFullSession(data: CreateSessionDto, files: Array<Express.Multer.File>): Promise<{
        message: string;
        sessionId: string;
        state: string;
    }>;
    updateSession(id: string, data: UpdateSessionDto, files: Array<Express.Multer.File>): Promise<{
        message: string;
        sessionId: string;
        state: string;
        update_count: number;
    }>;
    findMeasurementsByRange(startDate: string, endDate: string): Promise<Measurement[]>;
    private getUnit;
    findAll(): Promise<any[]>;
    getReportData(id: string): Promise<any>;
    findOne(id: string): Promise<Session | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
