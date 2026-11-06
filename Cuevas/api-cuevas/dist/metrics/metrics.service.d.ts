import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class SsrCuevasService {
    private repo;
    private readonly logger;
    constructor(repo: Repository<Telemetria>);
    private normalizeDateRange;
    private getAlarmLevel;
    getSnapshot(): Promise<{
        snapshot: MetricSnapshot;
        tiempo_vaciado_est_1: number;
        tiempo_vaciado_est_1_formatted: string;
        tiempo_vaciado_est_2: number;
        tiempo_vaciado_est_2_formatted: string;
        nivel_alerta: number;
    }>;
    private calculateAndCacheDaily;
    getTotalizador(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<Metric[]>;
    getKwh(dto: DateRangeDto): Promise<Metric[]>;
    private getSeries;
    private getPozoSeries;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<Metric[]>;
    getVoltaje2(dto: DateRangeDto): Promise<Metric[]>;
    getFreatico(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
    getCorriente(dto: DateRangeDto): Promise<Record<"I1" | "I2" | "I3", Metric[]>>;
    getVoltaje(dto: DateRangeDto): Promise<Record<"L1" | "L2" | "L3", Metric[]>>;
}
