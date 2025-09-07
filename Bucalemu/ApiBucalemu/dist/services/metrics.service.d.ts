import { DatabaseConfig } from "../config/database.config";
import { CreateMetricDto } from "../models/create-metric.dto";
import { Metric } from "../models/metric.interface";
export declare class MetricsService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    create(dto: CreateMetricDto): Promise<number>;
    findLatest(limit: number): Promise<Metric[]>;
    findLatestByName(name: string): Promise<Metric | null>;
    findLatestForEachName(): Promise<{
        [key: string]: {
            value: number;
            time: string;
        };
    }>;
    findLastUpdateTime(): Promise<Date | null>;
    estimateEmptyingTimes(): Promise<{
        [key: string]: string;
    }>;
    private estimateEmptyingTime;
    private formatSecondsToDuration;
    findAllMeasurements(): Promise<Record<string, {
        mt_value: number;
        mt_time_2: string;
    }[]>>;
    private formatDate;
}
