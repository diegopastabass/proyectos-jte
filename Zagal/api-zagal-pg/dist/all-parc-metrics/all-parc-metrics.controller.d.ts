import { AllParcMetricsService } from "./all-parc-metrics.service";
export declare class AllParcMetricsController {
    private readonly metricsService;
    constructor(metricsService: AllParcMetricsService);
    getActiveSectors(): Promise<{
        [key: string]: any[];
    }>;
}
