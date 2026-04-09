import { SsrRanguilService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrRanguilController {
    private readonly service;
    constructor(service: SsrRanguilService);
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
    getKwh(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getVoltaje(dto: DateRangeDto): Promise<{
        v1: import("./models/types").Metric[];
        v2: import("./models/types").Metric[];
        v3: import("./models/types").Metric[];
    }>;
    getCorriente(dto: DateRangeDto): Promise<{
        i1: import("./models/types").Metric[];
        i2: import("./models/types").Metric[];
        i3: import("./models/types").Metric[];
    }>;
    getPresion(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
