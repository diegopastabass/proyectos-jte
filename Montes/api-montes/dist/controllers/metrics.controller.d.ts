import { MetricsService } from '../services/metrics.service';
import { DateRangeDto, MesesDto } from '../models/dto/date-range.dto';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    latestAllNames(): Promise<Record<string, {
        value: number;
        time: Date;
    }>>;
    getDailyTotalizer(name: string, { start, end }: DateRangeDto): Promise<import("../services/metrics.service").Punto[]>;
    getMonthlyTotalizer(name: string, { meses }: MesesDto): Promise<import("../services/metrics.service").Punto[]>;
    getFlowRate(name: string, { start, end }: DateRangeDto): Promise<import("../services/metrics.service").Punto[]>;
    getHourlyTotalizer(name: string, { start, end }: DateRangeDto): Promise<import("../services/metrics.service").Punto[]>;
    getHourlyVolumeFromFlow(name: string, { start, end }: DateRangeDto): Promise<import("../services/metrics.service").Punto[]>;
}
