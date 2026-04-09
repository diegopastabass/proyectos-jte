import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class SsrRanguilService {
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
    private calculateAndCacheDaily;
    getTotalizador(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<Metric[]>;
    getKwh(dto: DateRangeDto): Promise<Metric[]>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getCorriente(dto: DateRangeDto): Promise<{
        i1: Metric[];
        i2: Metric[];
        i3: Metric[];
    }>;
    getVoltaje(dto: DateRangeDto): Promise<{
        v1: Metric[];
        v2: Metric[];
        v3: Metric[];
    }>;
    getPresion(dto: DateRangeDto): Promise<Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
}
