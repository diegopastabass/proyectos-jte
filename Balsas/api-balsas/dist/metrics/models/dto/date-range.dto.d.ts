import type { Pozo } from '../../../config/sensores.config';
export declare class DateRangeDto {
    start?: string;
    end?: string;
    limit?: number;
}
export declare class PozoQueryDto extends DateRangeDto {
    pozo: Pozo;
}
export declare class VoltajeQueryDto extends PozoQueryDto {
    tipo?: 'fase' | 'linea';
}
