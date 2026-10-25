import { Repository } from 'typeorm';
import { CaliforniaReport } from './models/reports.entity';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';
export declare class ReportsService {
    private repo;
    constructor(repo: Repository<CaliforniaReport>);
    create(dto: CreateReportDto): Promise<CaliforniaReport>;
    findAll(dto: DateRangeDto): Promise<CaliforniaReport[]>;
}
