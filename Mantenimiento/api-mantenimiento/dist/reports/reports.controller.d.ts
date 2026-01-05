import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    create(createReportDto: CreateReportDto, req: any): Promise<import("./entities/report.entity").Report>;
    findAll(): Promise<import("./entities/report.entity").Report[]>;
    findOne(id: string): Promise<import("./entities/report.entity").Report>;
}
