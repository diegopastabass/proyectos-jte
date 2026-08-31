export declare class Vehicle {
    id: string;
    marca: string;
    modelo: string;
    patente: string;
    ano: number;
    kilometraje: number;
    km_ultima_mantencion: number;
    km_desde_ultima_mantencion: number;
    vencimiento_revision_tecnica: Date;
    vencimiento_permiso_circulacion: Date;
    vencimiento_seguro: Date;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
