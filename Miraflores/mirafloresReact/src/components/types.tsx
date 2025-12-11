export interface Metric {
  value: number;
  time: string;
}

export interface TimeSeriesChartProps {
  title: string;
  metrics: Metric[];
  barColor: string;
}

export interface Snapshot {
  caudal: Metric;
  pozo: Metric;
  totalizador: Metric;
}
