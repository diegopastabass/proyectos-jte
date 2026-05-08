import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class SsrCompaniaService {
    private repo;
    constructor(repo: Repository<Telemetria>);
    private normalizeDateRange;
    getSnapshot(): Promise<{
        snapshot: MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
}
