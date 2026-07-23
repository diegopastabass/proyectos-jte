import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
export declare class ReportsService {
    private readonly reportRepository;
    private readonly UPLOAD_DIR;
    private readonly PUBLIC_PATH_PREFIX;
    constructor(reportRepository: Repository<Report>);
    create(createReportDto: CreateReportDto, userId: string, files?: Express.Multer.File[]): Promise<Report>;
    findAll(): Promise<Report[]>;
    findOne(id: string): Promise<Report>;
    update(id: string, updateReportDto: UpdateReportDto): Promise<Report>;
    remove(id: string): Promise<void>;
    getUniqueClientNames(): Promise<string[]>;
    private ensureUploadDirExists;
    private saveImages;
    private extractExtension;
}
