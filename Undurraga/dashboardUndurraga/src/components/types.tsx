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
  1: Metric;
  2: Metric;
  3: Metric;
  4: Metric;
  5: Metric;
  6: Metric;
}
