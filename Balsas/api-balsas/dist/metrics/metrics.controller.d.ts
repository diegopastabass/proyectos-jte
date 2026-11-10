import { SsrBalsasService } from './metrics.service';
import { DateRangeDto, PozoQueryDto, VoltajeQueryDto } from './models/dto/date-range.dto';
export declare class SsrBalsasController {
    private readonly service;
    constructor(service: SsrBalsasService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        equipos: ({
            time: string | null;
            id: "pozo_1";
            nombre: "Pozo 1";
            equipo: "UNO_BALSAS";
        } | {
            time: string | null;
            id: "pozo_2";
            nombre: "Pozo 2";
            equipo: "DOS_BALSAS";
        } | {
            time: string | null;
            id: "estanque";
            nombre: "Estanque";
            equipo: "ESTANQUE_BALSAS";
        })[];
        tiempo_vaciado: {
            tiempo: number;
            formatted: string;
            tendencia: import("./metrics.service").Tendencia;
        };
        nivel_alerta: number;
        nivel_maximo: number;
    }>;
    getEquipos(): Promise<{
        snapshot: Record<string, {
            time: string | null;
        }>;
    }>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getPresion(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudalDescarga(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getSolar(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getVoltaje(dto: VoltajeQueryDto): Promise<Record<"L1N" | "L2N" | "L3N" | "L1L2" | "L2L3" | "L3L1", import("./models/types").Metric[]>>;
    getCorriente(dto: PozoQueryDto): Promise<Record<"I1" | "I2" | "I3", import("./models/types").Metric[]>>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getTotalizadorDescarga(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: PozoQueryDto): Promise<import("./models/types").Metric[]>;
}
