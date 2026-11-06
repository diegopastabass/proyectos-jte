// Configuración y tipos de APR El Tambo. Los nombres coinciden con los que
// sirve api-tambo (src/config/sensores.config.ts).

export const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "https://app.jteanalytics.cl/tambo";

export type PozoId = "pozo_1" | "pozo_3";
export type EstanqueId =
  | "estanque_superior"
  | "estanque_intermedio"
  | "estanque_inferior";

export interface PozoConfig {
  id: PozoId;
  nombre: string;
  /** Tag de la bomba y del caudalímetro en el diagrama. */
  tagBomba: string;
  tagCaudal: string;
  /** El caudalímetro entrega el caudal multiplicado por este factor (120 = 12,0 l/s). */
  divisorCaudal: number;
  /** false mientras el pozo no envía datos: se dibuja con la bomba apagada. */
  conDatos: boolean;
}

export interface EstanqueConfig {
  id: EstanqueId;
  nombre: string;
  tag: string;
  /** Valor que corresponde al estanque lleno, ya dividido por `divisor`. */
  maximo: number;
  unidad: string;
  /** El sensor entrega el nivel multiplicado por este factor (825 = 82,5 %). */
  divisor: number;
  /** Nivel de alarma baja, ya dividido. Debe coincidir con nivel_alerta de monitor_config.json. */
  alarma: number;
}

export const POZOS: PozoConfig[] = [
  { id: "pozo_1", nombre: "Pozo 1", tagBomba: "B-01", tagCaudal: "FIT-01", divisorCaudal: 1, conDatos: true },
  { id: "pozo_3", nombre: "Pozo 3", tagBomba: "B-03", tagCaudal: "FIT-03", divisorCaudal: 10, conDatos: true },
];

export const POZOS_CON_DATOS = POZOS.filter((p) => p.conDatos);

// El HMI de COPSET muestra los niveles en %. El valor que llega viene ×10, por eso
// divisor: 10. Si el sensor entrega metros, cambiar maximo, unidad y divisor aquí.
export const ESTANQUES: EstanqueConfig[] = [
  { id: "estanque_superior", nombre: "Estanque Superior", tag: "LIT-001", maximo: 100, unidad: "%", divisor: 10, alarma: 50 },
  { id: "estanque_intermedio", nombre: "Estanque Intermedio", tag: "LIT-002", maximo: 100, unidad: "%", divisor: 10, alarma: 50 },
  { id: "estanque_inferior", nombre: "Estanque Bajo", tag: "LIT-003", maximo: 100, unidad: "%", divisor: 10, alarma: 50 },
];

export interface Metric {
  value: number;
  time: string;
}

export type Snapshot = Partial<Record<PozoId | EstanqueId, Metric>>;

export interface TiempoVaciado {
  tiempo: number;
  formatted: string;
}

export interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado: Partial<Record<EstanqueId, TiempoVaciado>>;
}

/** Bomba encendida: caudal mayor a 0 (misma regla que usa el horómetro). */
export const bombaEncendida = (snapshot: Snapshot, pozo: PozoId) =>
  (snapshot[pozo]?.value ?? 0) > 0;

export const formatMinutes = (total: number) => {
  const minutes = Math.max(0, Math.floor(total));
  return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
};

export const todayInChile = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Arma una URL de la API agregando parámetros (sirve si path ya trae "?"). */
export const apiUrl = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
};
