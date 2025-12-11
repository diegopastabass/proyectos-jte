import { Repository } from "typeorm";
import { Parc82Zagal } from "./parc82.entity";
export interface LatestMetricResult {
    caudal: number;
    totalizador: number;
}
export declare class MetricsService {
    private readonly repo;
    constructor(repo: Repository<Parc82Zagal>);
    private sectorMap;
    private mapParcela;
    findLatest(): Promise<LatestMetricResult>;
    activeSectors(): Promise<{
        mt_name: string;
        is_active: number;
    }[]>;
    findLatestByName(name: string): Promise<Parc82Zagal | null>;
    findLatestForEachName(): Promise<{
        [key: string]: number;
    }>;
    findLastUpdateTime(): Promise<Date | null>;
    findIrrigationInterval(): Promise<{
        mt_name: string;
        is_active: number;
        tiempo_riego_segundos: number;
        totalizador: number;
    }[]>;
    getDailyIrrigationSummary(startDate: string, endDate: string): Promise<any>;
}
