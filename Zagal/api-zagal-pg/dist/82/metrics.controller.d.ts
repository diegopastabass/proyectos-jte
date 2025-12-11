import { MetricsService, LatestMetricResult } from "./metrics.service";
export declare class MetricsController {
    private readonly service;
    constructor(service: MetricsService);
    latestAllNames(): Promise<{
        [key: string]: number;
    }>;
    latestMetric(): Promise<LatestMetricResult>;
    latestUpdate(): Promise<Date | null>;
    irrigationInterval(): Promise<{
        mt_name: string;
        is_active: number;
        tiempo_riego_segundos: number;
        totalizador: number;
    }[]>;
    getIrrigationTimeSummary(startDate: string, endDate: string): Promise<any>;
    getLatestSectorMetrics(): Promise<{
        mt_name: string;
        is_active: number;
    }[]>;
}
