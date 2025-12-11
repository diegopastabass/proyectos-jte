export interface RiegoResponse {
  mt_name: string;
  is_active: number; // 1 si activo, 0 si inactivo
  tiempo_riego_segundos: number; // segundos desde la última parada hasta ahora
}
