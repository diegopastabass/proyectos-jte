import { DatabaseConfig } from "../../config/database.config";
import { Metric } from "../models/metric.interface";
import { RiegoResponse } from "../models/riego-response.dto";
export interface LatestMetricResult {
    caudal: number;
    totalizador: number;
}
export declare class MetricsService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    findLatest(): Promise<LatestMetricResult>;
    findLatestByName(name: string): Promise<Metric | null>;
    findLatestForEachName(): Promise<{
        [key: string]: number;
    }>;
    findLastUpdateTime(): Promise<Date | null>;
    findIrrigationInterval(): Promise<RiegoResponse[]>;
    getDailyIrrigationSummary(startDate: string, endDate: string): Promise<{
        mt_name: string;
        date: string;
        value: number;
        totalizador: number;
        caudal: number;
    }[]>;
}
