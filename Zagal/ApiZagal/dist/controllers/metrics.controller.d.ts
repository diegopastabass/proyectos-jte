import { MetricsService } from "../services/metrics.service";
export declare class MetricsController {
    private readonly service;
    constructor(service: MetricsService);
    latestAllNames(): Promise<{
        [key: string]: number;
    }>;
    latestCaudal(): Promise<import("../models/metric.interface").Metric[]>;
    latestUpdate(): Promise<Date | null>;
    irrigationInterval(): Promise<import("../models/data.interface").RiegoResponse[] | null>;
    getIrrigationTimeByRange(startDate: string, endDate: string): Promise<{
        mt_name: string;
        date: string;
        value: number;
    }[]>;
}
