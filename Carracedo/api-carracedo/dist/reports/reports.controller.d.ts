import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';
export declare class ReportsController {
    private readonly service;
    constructor(service: ReportsService);
    create(req: Request, dto: CreateReportDto): Promise<import("./models/reports.entity").CarracedoReport>;
    findAll(dto: DateRangeDto): Promise<import("./models/reports.entity").CarracedoReport[]>;
}
