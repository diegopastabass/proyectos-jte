import { SsrTrinidadService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrTrinidadController {
    private readonly service;
    constructor(service: SsrTrinidadService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    getTotalizador_pozo(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getTotalizador_sentina(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro_e1(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro_e2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro_bomba_pozo(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
