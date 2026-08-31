import { Repository, DataSource } from 'typeorm';
import { Checklist } from '../entities/checklist.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { CreateChecklistDto } from './dto/create-checklist.dto';
export declare class ChecklistsService {
    private checklistsRepository;
    private vehiclesRepository;
    private dataSource;
    constructor(checklistsRepository: Repository<Checklist>, vehiclesRepository: Repository<Vehicle>, dataSource: DataSource);
    create(user_id: string, createChecklistDto: CreateChecklistDto, files: Express.Multer.File[]): Promise<Checklist>;
    findAll(user: any): Promise<Checklist[]>;
    findOne(id: string, user: any): Promise<Checklist>;
}
