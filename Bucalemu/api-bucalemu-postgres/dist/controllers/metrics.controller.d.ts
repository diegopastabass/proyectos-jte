import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { DateRangeDto } from 'src/models/dto/date-range.dto';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    create(dto: CreateMetricDto): Promise<{
        success: boolean;
        message: string;
    }>;
    latest(limit: number): Promise<import("../services/metrics.service").Metric[]>;
    latestByName(name: string): Promise<import("../services/metrics.service").Metric | null>;
    latestAllNames(): Promise<Record<string, {
        value: number;
        time: Date;
    }>>;
    latestUpdate(): Promise<Date | null>;
    emptyingTimes(): Promise<{
        [key: string]: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<import("../services/metrics.service").Total[]>;
    allMeasurements(): Promise<Record<string, {
        mt_value: number;
        mt_time_2: Date;
    }[]>>;
    getCaudal(dto: DateRangeDto): Promise<{
        time: string;
        value: number;
    }[]>;
}
