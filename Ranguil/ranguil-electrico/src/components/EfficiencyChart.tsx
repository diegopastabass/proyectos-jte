import { Chart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import "../lib/chartSetup";
import Card from "./Card";
import type { DailyRow } from "../types";
import { median } from "../lib/electrical";
import { formatDayShort } from "../lib/time";
import { chartTheme, useDarkTheme } from "../lib/useDarkTheme";

interface EfficiencyChartProps {
  rows: DailyRow[];
}

function EfficiencyChart({ rows }: EfficiencyChartProps) {
  const theme = chartTheme(useDarkTheme());
  const labels = rows.map((r) => formatDayShort(r.date));
  const ref = median(
    rows.filter((r) => r.kwhPorM3 !== null).map((r) => r.kwhPorM3 as number),
  );

  const data: ChartData<"bar" | "line", (number | null)[], string> = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Costo diario ($)",
        data: rows.map((r) => Math.round(r.costo)),
        backgroundColor: "rgba(13,110,253,0.45)",
        borderColor: "rgba(13,110,253,1)",
        borderWidth: 1,
        yAxisID: "y1",
        order: 2,
      },
      {
        type: "line",
        label: "kWh/m³",
        data: rows.map((r) => r.kwhPorM3),
        borderColor: "#fd7e14",
        backgroundColor: "#fd7e14",
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 3,
        yAxisID: "y",
        order: 1,
      },
      {
        type: "line",
        label: "Mediana kWh/m³",
        data: rows.map(() => ref),
        borderColor: "rgba(253,126,20,0.6)",
        borderDash: [6, 4],
        borderWidth: 1,
        pointRadius: 0,
        yAxisID: "y",
        order: 1,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { labels: { color: theme.text } } },
    scales: {
      x: { ticks: { color: theme.text }, grid: { display: false } },
      y: {
        position: "left",
        beginAtZero: true,
        title: { display: true, text: "kWh/m³", color: theme.text },
        ticks: { color: theme.text },
        grid: { color: theme.grid },
      },
      y1: {
        position: "right",
        beginAtZero: true,
        title: { display: true, text: "Costo ($)", color: theme.text },
        ticks: { color: theme.text },
        grid: { drawOnChartArea: false },
      },
    },
  };

  return (
    <Card className="panel">
      <div className="panel-title">
        <i className="bi bi-cash-coin me-1"></i>Eficiencia y costo energético diario
      </div>
      <div style={{ height: 280 }}>
        <Chart type="bar" data={data as ChartData<"bar">} options={options} />
      </div>
    </Card>
  );
}

export default EfficiencyChart;
