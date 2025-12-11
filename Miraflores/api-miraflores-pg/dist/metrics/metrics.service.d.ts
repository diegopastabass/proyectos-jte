import { Repository } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
export declare class MirafloresService {
    private repo;
    constructor(repo: Repository<Telemetria>);
    getSnapshot(): Promise<MetricSnapshot>;
    getTotalizador(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<Metric[]>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
}
