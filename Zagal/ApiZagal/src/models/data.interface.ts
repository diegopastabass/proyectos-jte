export interface RiegoIntervalo {
  tiempo_inicio: string; // datetime -> string ISO
  tiempo_fin: string | null; // puede ser null si el riego sigue en curso
  tiempo_riego_segundos: number; // duración en segundos
  caudal_promedio: number; // caudal medio en el intervalo
}

export type RiegoResponse = RiegoIntervalo[];
