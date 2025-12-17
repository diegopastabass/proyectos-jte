import { SsrBoldosService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrBoldosController {
    private readonly service;
    constructor(service: SsrBoldosService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado_est_1: number;
        tiempo_vaciado_est_1_formatted: string;
        tiempo_vaciado_est_2: number;
        tiempo_vaciado_est_2_formatted: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
