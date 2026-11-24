import { ChecklistsService } from './checklists.service';
import { QueryChecklistsDto } from './dto/query-checklists.dto';
export declare class ChecklistsController {
    private readonly checklistsService;
    private readonly logger;
    constructor(checklistsService: ChecklistsService);
    create(req: any, data: string, files?: Express.Multer.File[]): Promise<import("../entities/checklist.entity").Checklist>;
    findAll(req: any, query: QueryChecklistsDto): Promise<{
        items: import("../entities/checklist.entity").Checklist[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(req: any, id: number): Promise<import("../entities/checklist.entity").Checklist>;
    remove(req: any, id: number): Promise<void>;
}
