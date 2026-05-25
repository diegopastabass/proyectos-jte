import { SsrCompaniaService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrCompaniaController {
    private readonly service;
    constructor(service: SsrCompaniaService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
