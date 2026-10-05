import { Repository } from 'typeorm';
import { CarracedoReport } from './models/reports.entity';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';
export declare class ReportsService {
    private repo;
    constructor(repo: Repository<CarracedoReport>);
    create(dto: CreateReportDto): Promise<CarracedoReport>;
    findAll(dto: DateRangeDto): Promise<CarracedoReport[]>;
}
