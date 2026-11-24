import { Repository, DataSource } from 'typeorm';
import { Checklist } from '../entities/checklist.entity';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { QueryChecklistsDto } from './dto/query-checklists.dto';
export declare class ChecklistsService {
    private checklistsRepository;
    private dataSource;
    private readonly logger;
    constructor(checklistsRepository: Repository<Checklist>, dataSource: DataSource);
    private baseName;
    private cleanChecks;
    create(user_id: string, dto: CreateChecklistDto, files: Express.Multer.File[]): Promise<Checklist>;
    findAll(user: any, q: QueryChecklistsDto): Promise<{
        items: Checklist[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string, user: any): Promise<Checklist>;
    remove(id: string, user: any): Promise<void>;
}
