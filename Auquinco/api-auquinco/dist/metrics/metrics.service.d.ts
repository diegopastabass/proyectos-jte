import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class SsrAuquincoService {
    private repo;
    constructor(repo: Repository<Telemetria>);
    private normalizeDateRange;
    getSnapshot(): Promise<{
        snapshot: MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<Metric[]>;
    getKwh(dto: DateRangeDto): Promise<Metric[]>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
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
}
