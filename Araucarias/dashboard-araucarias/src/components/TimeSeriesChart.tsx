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
  type ChartOptions,
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
  Legend,
);

const formatDate = (isoString: string, includeTime: boolean): string => {
  const date = new Date(isoString);
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  const pad = (num: number): string => String(num).padStart(2, "0");
  const datePart = `${pad(day)}-${pad(month)}`;

  return includeTime ? `${datePart} ${pad(hours)}:${pad(minutes)}` : datePart;
};

interface ExtendedTimeSeriesChartProps extends TimeSeriesChartProps {
  chartType?: "bar" | "line";
  nivelMax?: number; // Aseguramos que esté en la interfaz
}

const TimeSeriesChart: React.FC<ExtendedTimeSeriesChartProps> = ({
  title,
  metrics,
  barColor,
  nivelMax,
  divisor = 1,
  chartType = "bar",
}) => {
  // Las opciones deben contener la escala
  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        color: "gray",
        align: "start",
        font: { size: 14 },
      },
      tooltip: {
        mode: "index",
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
        beginAtZero: true,
        max: nivelMax, // Se aplica aquí para ambos tipos de gráfico
      },
    },
    layout: {
      padding: { top: 20, left: 10, right: 10, bottom: 10 },
    },
  };

  const labels = metrics.map((m) => formatDate(m.time, chartType === "line"));
  const dataPoints = metrics.map((m) => m.value / divisor);

  const data: ChartData<"bar" | "line"> = {
    labels,
    datasets: [
      {
        label: title,
        data: dataPoints,
        backgroundColor: barColor,
        borderColor: barColor,
        borderWidth: chartType === "line" ? 2 : 0,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
        barPercentage: 0.8,
        categoryPercentage: 1.0,
      },
    ],
  };

  return (
    <div className="card p-2">
      <div className="card-body p-0" style={{ height: "250px" }}>
        {chartType === "bar" ? (
          <Bar
            options={options as ChartOptions<"bar">}
            data={data as ChartData<"bar">}
          />
        ) : (
          <Line
            options={options as ChartOptions<"line">}
            data={data as ChartData<"line">}
          />
        )}
      </div>
    </div>
  );
};

export default TimeSeriesChart;
