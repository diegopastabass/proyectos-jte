import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
export declare class ReportsService {
    private readonly reportRepository;
    constructor(reportRepository: Repository<Report>);
    create(createReportDto: CreateReportDto, userId: string): Promise<Report>;
    findAll(): Promise<Report[]>;
    findOne(id: string): Promise<Report>;
    update(id: string, updateReportDto: UpdateReportDto): Promise<Report>;
    remove(id: string): Promise<void>;
}
