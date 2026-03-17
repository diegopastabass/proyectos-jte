export interface Metric {
  time: string;
  value: number;
}

export type MetricSnapshot = Record<string, Metric>;

export interface DailyMetric {
  day: string;
  p_valor: number;
  u_valor: number;
  horometro_diario?: number;
}
