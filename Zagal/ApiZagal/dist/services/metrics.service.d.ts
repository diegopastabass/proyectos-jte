import { DatabaseConfig } from "../config/database.config";
import { Metric } from "../models/metric.interface";
import { RiegoResponse } from "src/models/data.interface";
export declare class MetricsService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    findLatest(limit: number): Promise<Metric[]>;
    findLatestByName(name: string): Promise<Metric | null>;
    findLatestForEachName(): Promise<{
        [key: string]: number;
    }>;
    findLastUpdateTime(): Promise<Date | null>;
    findIrrigationInterval(): Promise<RiegoResponse[] | null>;
    getIrrigationTimeByRange(startDate: string, endDate: string): Promise<{
        mt_name: string;
        date: string;
        value: number;
    }[]>;
}
