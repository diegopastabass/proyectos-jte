import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import type { TimeSeriesChartProps } from "../components/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// Formateo de fecha y hora
const formatDate = (isoString: string, includeTime: boolean): string => {
  const date = new Date(isoString);
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  const pad = (num: number): string => String(num).padStart(2, "0");
  const datePart = `${pad(day)}-${pad(month)}`;

  if (includeTime) {
    return `${datePart} ${pad(hours)}:${pad(minutes)}`;
  }

  return datePart;
};

interface ExtendedTimeSeriesChartProps extends TimeSeriesChartProps {
  chartType?: "bar" | "line";
}

const TimeSeriesChart: React.FC<ExtendedTimeSeriesChartProps> = ({
  title,
  metrics,
  barColor,
  chartType = "bar",
}) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: "gray",
        align: "start" as const,
        font: { size: 14 },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: { color: "#aaaaaa" },
        ticks: {
          color: "#aaaaaa",
          maxRotation: 45,
          minRotation: 45,
          font: { size: 10 },
        },
      },
      y: {
        grid: { color: "#aaaaaa" },
        ticks: { color: "black" },
        beginAtZero: false,
      },
    },
    layout: {
      padding: { top: 20, left: 10, right: 10, bottom: 10 },
    },
  };

  // Datos para gráfico de barras
  const createBarData = (): ChartData<"bar", number[], string> => ({
    labels: metrics.map((m) => formatDate(m.time, false)),
    datasets: [
      {
        label: title,
        data: metrics.map((m) => (title === "Nivel Pozo" ? m.value / 10 : m.value)),
        backgroundColor: barColor,
        barPercentage: 0.8,
        categoryPercentage: 1.0,
      },
    ],
  });

  // Datos para gráfico de líneas
  const createLineData = (): ChartData<"line", number[], string> => ({
    labels: metrics.map((m) => formatDate(m.time, true)),
    datasets: [
      {
        label: title,
        data: metrics.map((m) => (title === "Nivel Pozo" ? m.value / 10 : m.value)),
        borderColor: barColor,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
    ],
  });

  return (
    <div className="card p-2">
      <div className="card-body p-0 " style={{ height: "250px" }}>
        {chartType === "bar" ? (
          <Bar options={options} data={createBarData()} />
        ) : (
          <Line options={options} data={createLineData()} />
        )}
      </div>
    </div>
  );
};

export default TimeSeriesChart;