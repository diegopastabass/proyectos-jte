import { MetricsService, LatestMetricResult } from "../services/metrics.service";
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
        tiempo_riego_segundos: any;
        totalizador: number;
    }[]>;
    getIrrigationTimeSummary(startDate: string, endDate: string): Promise<{
        mt_name: string;
        date: string;
        value: number;
        totalizador: number;
        caudal: number;
    }[]>;
}
