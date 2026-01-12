import { SsrPuQuillayService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrPuQuillayController {
    private readonly service;
    constructor(service: SsrPuQuillayService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
        tiempo_vaciado_2: number;
        tiempo_vaciado_2_formatted: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
