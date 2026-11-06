import { SsrCuevasService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrCuevasController {
    private readonly service;
    constructor(service: SsrCuevasService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado_est_1: number;
        tiempo_vaciado_est_1_formatted: string;
        tiempo_vaciado_est_2: number;
        tiempo_vaciado_est_2_formatted: string;
        nivel_alerta: number;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getVoltaje2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getFreatico(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getKwh(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getVoltaje(dto: DateRangeDto): Promise<Record<"L1" | "L2" | "L3", import("./models/types").Metric[]>>;
    getCorriente(dto: DateRangeDto): Promise<Record<"I1" | "I2" | "I3", import("./models/types").Metric[]>>;
}
