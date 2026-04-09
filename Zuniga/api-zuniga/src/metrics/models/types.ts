export interface Metric {
  time: string;
  value: number;
}

export type MetricSnapshot = Record<string, Metric>;
