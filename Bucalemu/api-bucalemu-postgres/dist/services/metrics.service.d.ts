import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { DateRangeDto } from '../models/dto/date-range.dto';
import { Metric } from '../models/metric.entity';
export declare class Total {
    time: string;
    value: number;
}
export declare class MetricsService implements OnModuleInit, OnModuleDestroy {
    private readonly metricRepository;
    private readonly logger;
    private metricsBuffer;
    private flushInterval;
    private lastDataArrivalTime;
    private noDataAlertSent;
    private noDataCheckInterval;
    private readonly cache;
    private readonly inFlight;
    private static readonly CACHE_TTL;
    constructor(metricRepository: Repository<Metric>);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private appendToPostLog;
    private checkDataArrival;
    createMetric(dto: CreateMetricDto): Promise<{
        success: boolean;
        message: string;
    }>;
    private flushMetrics;
    findLatestMetrics(limit: number): Promise<Metric[]>;
    findLatestMetricByName(name: string): Promise<Metric | null>;
    findLatestForEachName(): Promise<Record<string, {
        value: number;
        time: Date;
    }>>;
    findLastUpdateTime(): Promise<Date | null>;
    findAllMeasurements(): Promise<Record<string, {
        mt_value: number;
        mt_time_2: Date;
    }[]>>;
    estimateEmptyingTimes(): Promise<{
        [key: string]: string;
    }>;
    private estimateEmptyingTime;
    getTotalizador(dto: DateRangeDto): Promise<Total[]>;
    private formatDate;
    getCaudal(dto: DateRangeDto): Promise<{
        time: string;
        value: number;
    }[]>;
    getSnapshot(): Promise<{
        latest: Record<string, {
            value: number;
            time: Date;
        }>;
        levels: Record<string, {
            mt_value: number;
            mt_time_2: Date;
        }[]>;
        emptying: {
            [key: string]: string;
        };
        caudal: {
            time: string;
            value: number;
        }[];
    }>;
    private formatSecondsToDuration;
}
