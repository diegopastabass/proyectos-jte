import { MetricsService } from "../services/metrics.service";
import { CreateMetricDto } from "../models/create-metric.dto";
export declare class MetricsController {
    private readonly service;
    constructor(service: MetricsService);
    create(dto: CreateMetricDto): Promise<{
        success: boolean;
        insertedId: number;
    }>;
    latest(limit: number): Promise<import("../models/metric.interface").Metric[]>;
    latestByName(name: string): Promise<import("../models/metric.interface").Metric | null>;
    latestAllNames(): Promise<{
        [key: string]: {
            value: number;
            time: string;
        };
    }>;
    latestUpdate(): Promise<Date | null>;
    emptyingTimes(): Promise<{
        [key: string]: string;
    }>;
}
