export interface RiegoIntervalo {
    tiempo_inicio: string;
    tiempo_fin: string | null;
    tiempo_riego_segundos: number;
    caudal_promedio: number;
}
export type RiegoResponse = RiegoIntervalo[];
