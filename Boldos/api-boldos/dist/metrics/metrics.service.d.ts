import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class SsrBoldosService {
    private repo;
    constructor(repo: Repository<Telemetria>);
    private normalizeDateRange;
    getSnapshot(): Promise<{
        snapshot: MetricSnapshot;
        tiempo_vaciado_est_1: number;
        tiempo_vaciado_est_1_formatted: string;
        tiempo_vaciado_est_2: number;
        tiempo_vaciado_est_2_formatted: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<Metric[]>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
}
