import { ChecklistsService } from './checklists.service';
export declare class ChecklistsController {
    private readonly checklistsService;
    constructor(checklistsService: ChecklistsService);
    create(req: any, data: string, files: Express.Multer.File[]): Promise<import("../entities/checklist.entity").Checklist>;
    findAll(req: any): Promise<import("../entities/checklist.entity").Checklist[]>;
    findOne(req: any, id: string): Promise<import("../entities/checklist.entity").Checklist>;
    remove(req: any, id: string): Promise<void>;
}
