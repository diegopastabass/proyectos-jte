export interface Metric {
  value: number;
  time: string;
}

export interface TimeSeriesChartProps {
  title: string;
  metrics: Metric[];
  barColor: string;
}

export interface Latest {
  montes_general_caudal: Metric;
  montes_general_totalizador: Metric;
  montes_riles_caudal: Metric;
  montes_riles_totalizador: Metric;
}
