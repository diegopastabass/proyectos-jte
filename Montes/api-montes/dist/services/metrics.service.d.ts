import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { Metric } from '../models/metric.entity';
export declare class MetricsService implements OnModuleInit, OnModuleDestroy {
    private readonly metricRepository;
    private readonly logger;
    private metricsBuffer;
    private flushInterval;
    constructor(metricRepository: Repository<Metric>);
    onModuleInit(): void;
    onModuleDestroy(): void;
    createMetric(dto: CreateMetricDto): Promise<{
        success: boolean;
        message: string;
    }>;
    private flushMetrics;
    findLatestForEachName(): Promise<Record<string, {
        value: number;
        time: Date;
    }>>;
}
