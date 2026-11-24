export declare const normalizePatente: ({ value }: {
    value: unknown;
}) => unknown;
export declare const emptyToNull: ({ value }: {
    value: unknown;
}) => unknown;
export declare const PATENTE_REGEX: RegExp;
export declare class CreateVehicleDto {
    model: string;
    patente: string;
    kilometraje?: number;
    km_ultima_mantencion?: number;
    fecha_venc_revision_tecnica?: string | null;
    fecha_venc_circulacion?: string | null;
    fecha_prox_mantencion?: string | null;
}
