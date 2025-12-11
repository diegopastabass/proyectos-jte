import { DatabaseConfig } from "../../config/database.config";
import { Metric } from "../models/metric.interface";
export interface LatestMetricResult {
    caudal: number;
    totalizador: number;
}
export declare class MetricsService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    private sectorMap;
    private mapParcela;
    findLatest(): Promise<LatestMetricResult>;
    findLatestByName(name: string): Promise<Metric | null>;
    findLatestForEachName(): Promise<{
        [key: string]: number;
    }>;
    findLastUpdateTime(): Promise<Date | null>;
    findIrrigationInterval(): Promise<{
        mt_name: string;
        is_active: number;
        tiempo_riego_segundos: any;
        totalizador: number;
    }[]>;
    getDailyIrrigationSummary(startDate: string, endDate: string): Promise<{
        mt_name: string;
        date: string;
        value: number;
        totalizador: number;
        caudal: number;
    }[]>;
}
