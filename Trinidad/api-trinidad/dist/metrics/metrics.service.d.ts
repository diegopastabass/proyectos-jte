import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class SsrTrinidadService implements OnModuleInit, OnModuleDestroy {
    private repo;
    private readonly logger;
    private mysqlPool;
    constructor(repo: Repository<Telemetria>);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    private normalizeDateRange;
    getSnapshot(): Promise<{
        snapshot: MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    private calculateAndCacheDaily;
    getTotalizador_pozo(dto: DateRangeDto): Promise<Metric[]>;
    getTotalizador_sentina(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro_e1(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro_e2(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro_pozo(dto: DateRangeDto): Promise<Metric[]>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
}
