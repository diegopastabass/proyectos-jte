export interface Metric {
  value: number;
  time: string;
}

export interface Datos {
  automatico: Metric;
  bomba: Metric;
  caudal: Metric;
  estanque: Metric;
  estanque_2: Metric;
  falla: Metric;
  freatico: Metric;
  horometro: Metric;
  totalizador: Metric;
  i1: Metric;
  i2: Metric;
  i3: Metric;
  v1: Metric;
  v2: Metric;
  v3: Metric;
  kwh: Metric;
  presion: Metric;
}

export interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
  tiempo_vaciado_est_2: number;
  tiempo_vaciado_est_2_formatted: string;
}

export interface RawSeries {
  voltaje: { v1: Metric[]; v2: Metric[]; v3: Metric[] };
  corriente: { i1: Metric[]; i2: Metric[]; i3: Metric[] };
  caudal: Metric[];
  presion: Metric[];
}

// Muestra alineada (una por ciclo de 5 min) con todas las variables eléctricas
export interface Sample {
  t: number; // epoch ms
  day: string; // YYYY-MM-DD hora Santiago
  dayUtc: string; // YYYY-MM-DD UTC (misma agrupación que los diarios del API)
  hour: number; // 0-23 hora Santiago
  v: [number, number, number]; // V
  i: [number, number, number]; // A
  iAvg: number;
  kva: number; // potencia aparente Σ Vf·If
  running: boolean;
  q: number | null; // l/s
  p: number | null; // bar
}

export interface DailyRow {
  date: string;
  horas: number;
  m3: number;
  kwh: number;
  kwhPorM3: number | null;
  costo: number;
  arranques: number;
  desbalanceI: number | null; // % P95 de la jornada en operación
  desbalanceV: number | null;
  fpImplicito: number | null;
}

export type Severity = "ok" | "warn" | "bad";

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface ElectricConfig {
  tarifaClpKwh: number; // $/kWh
  kwhFactor: number; // factor del registro kWh del PLC → kWh reales
  vNominal: number; // V fase-neutro
  iNominal: number; // A de placa del motor
}
