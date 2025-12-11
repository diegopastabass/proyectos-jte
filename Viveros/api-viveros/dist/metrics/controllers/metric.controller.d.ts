import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
export declare class MetricsController {
    private readonly metricsService;
    constructor(metricsService: MetricsService);
    create(dto: CreateMetricDto): Promise<{
        success: boolean;
        insertedId: number;
    }>;
}
