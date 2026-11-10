import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DateRangeDto, PozoQueryDto, VoltajeQueryDto } from './models/dto/date-range.dto';
import { Metric, MetricSnapshot } from './models/types';
export type Tendencia = 'vaciado' | 'llenado' | 'estable' | 'sin_datos';
export declare class SsrBalsasService {
    private readonly db;
    private readonly config;
    private readonly logger;
    constructor(db: DataSource, config: ConfigService);
    private umbral;
    private ultimasLecturas;
    private ultimoPorEquipo;
    getSnapshot(): Promise<{
        snapshot: MetricSnapshot;
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
            tendencia: Tendencia;
        };
        nivel_alerta: number;
        nivel_maximo: number;
    }>;
    getEquipos(): Promise<{
        snapshot: Record<string, {
            time: string | null;
        }>;
    }>;
    private calcularTiempoVaciado;
    private serie;
    private seriesPozo;
    private exigirRango;
    private totalDiario;
    getTotalizador(dto: DateRangeDto): Promise<Metric[]>;
    getTotalizadorDescarga(dto: DateRangeDto): Promise<Metric[]>;
    getHorometro(dto: PozoQueryDto): Promise<Metric[]>;
    getNivel(dto: DateRangeDto): Promise<Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<Metric[]>;
    getPresion(dto: DateRangeDto): Promise<Metric[]>;
    getCaudalDescarga(dto: DateRangeDto): Promise<Metric[]>;
    getSolar(dto: DateRangeDto): Promise<Metric[]>;
    getVoltaje(dto: VoltajeQueryDto): Promise<Record<"L1N" | "L2N" | "L3N" | "L1L2" | "L2L3" | "L3L1", Metric[]>>;
    getCorriente(dto: PozoQueryDto): Promise<Record<"I1" | "I2" | "I3", Metric[]>>;
}
