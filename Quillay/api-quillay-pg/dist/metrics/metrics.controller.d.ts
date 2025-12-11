import { SsrQuillayService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrQuillayController {
    private readonly service;
    constructor(service: SsrQuillayService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado_hormigon: number;
        tiempo_vaciado_hormigon_formatted: string;
        tiempo_vaciado_metalico: number;
        tiempo_vaciado_metalico_formatted: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
