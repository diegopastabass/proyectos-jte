import { MetricsService, LatestMetricResult } from "../services/metrics.service";
export declare class MetricsController {
    private readonly service;
    constructor(service: MetricsService);
    latestAllNames(): Promise<{
        [key: string]: number;
    }>;
    latestMetric(): Promise<LatestMetricResult>;
    latestUpdate(): Promise<Date | null>;
    irrigationInterval(): Promise<import("../models/riego-response.dto").RiegoResponse[]>;
    getIrrigationTimeSummary(startDate: string, endDate: string): Promise<{
        mt_name: string;
        date: string;
        value: number;
        totalizador: number;
        caudal: number;
    }[]>;
}
