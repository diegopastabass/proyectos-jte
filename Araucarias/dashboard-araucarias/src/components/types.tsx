export interface Metric {
  value: number;
  time: string;
}

export interface TimeSeriesChartProps {
  title: string;
  metrics: Metric[];
  barColor: string;
  divisor?: number | 1;
  nivelMax?: number;
}

export interface Snapshot {
  caudal: Metric;
  freatico: Metric;
  totalizador: Metric;
}
