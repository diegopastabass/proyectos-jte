// Configuración y tipos de SSR Las Balsas. Los nombres coinciden con los que
// sirve api-balsas (src/config/sensores.config.ts), ya en unidades de ingeniería.

export const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "https://app.jteanalytics.cl/balsas";

export type PozoId = "pozo_1" | "pozo_2";

export const POZOS: { id: PozoId; nombre: string; tagBomba: string }[] = [
  { id: "pozo_1", nombre: "Pozo 1", tagBomba: "B-01" },
  { id: "pozo_2", nombre: "Pozo 2", tagBomba: "B-02" },
];

export interface Metric {
  value: number;
  time: string;
}

export type MultiSeries = Record<string, Metric[]>;
export type Snapshot = Partial<Record<string, Metric>>;

export interface Equipo {
  id: string;
  nombre: string;
  equipo: string;
  time: string | null;
}

export interface TiempoVaciado {
  tiempo: number;
  formatted: string;
  tendencia: "vaciado" | "llenado" | "estable" | "sin_datos";
}

export interface Datos {
  snapshot: Snapshot;
  equipos: Equipo[];
  tiempo_vaciado: TiempoVaciado;
  nivel_alerta: number;
  nivel_maximo: number;
}

/** Minutos sin datos. SIN_DATOS_MIN es el mismo umbral con que alerta el monitor. */
export const RETRASO_MIN = 10;
export const SIN_DATOS_MIN = 30;

export type EstadoComunicacion = "ok" | "retrasado" | "sin_datos";

export const minutosDesde = (time: string | null, ahora: number) =>
  time === null ? null : Math.floor((ahora - new Date(time).getTime()) / 60000);

export const estadoComunicacion = (
  time: string | null,
  ahora: number,
): EstadoComunicacion => {
  const minutos = minutosDesde(time, ahora);
  if (minutos === null || minutos > SIN_DATOS_MIN) return "sin_datos";
  return minutos > RETRASO_MIN ? "retrasado" : "ok";
};

export const formatMinutes = (total: number) => {
  const minutes = Math.max(0, Math.floor(total));
  return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
};

export const formatDuracion = (minutos: number) => {
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
  return `${Math.floor(minutos / 1440)} d ${Math.floor((minutos % 1440) / 60)} h`;
};

export const todayInChile = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Arma una URL de la API agregando parámetros. */
export const apiUrl = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
};

/** Valor del día de hoy en una serie diaria (AAAA-MM-DD). */
export const valorDeHoy = (serie: Metric[] | undefined, hoy: string) =>
  serie?.find((m) => m.time.slice(0, 10) === hoy)?.value ?? 0;
