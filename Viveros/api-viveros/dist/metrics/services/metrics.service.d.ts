import { Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { Metric } from '../models/metric.entity';
export declare class MetricsService {
    private readonly metricRepository;
    private readonly logger;
    constructor(metricRepository: Repository<Metric>);
    createMetric(dto: CreateMetricDto): Promise<{
        success: boolean;
        insertedId: number;
    }>;
}
