import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Metric } from '../models/metric.entity';
export declare const SENSORES: {
    readonly caudal: readonly ["montes_riles_caudal", "montes_general_caudal"];
    readonly totalizador: readonly ["montes_riles_totalizador", "montes_general_totalizador"];
};
export interface Punto {
    value: number;
    time: string;
}
export declare class MetricsService {
    private readonly metricRepository;
    private readonly logger;
    private readonly maxM3h;
    private readonly maxHorasLectura;
    private tablaDiariaDisponible;
    constructor(metricRepository: Repository<Metric>, config: ConfigService);
    private validarSensor;
    private validarRango;
    findLatestForEachName(): Promise<Record<string, {
        value: number;
        time: Date;
    }>>;
    getFlowRate(name: string, start?: string, end?: string): Promise<Punto[]>;
    getDailyTotalizer(name: string, start?: string, end?: string): Promise<Punto[]>;
    getMonthlyTotalizer(name: string, meses?: number): Promise<Punto[]>;
    getHourlyTotalizer(name: string, start?: string, end?: string): Promise<Punto[]>;
    getHourlyVolumeFromFlow(name: string, start?: string, end?: string): Promise<Punto[]>;
    private diario;
    private consumoPorDia;
    private desactivarTablaDiaria;
}
