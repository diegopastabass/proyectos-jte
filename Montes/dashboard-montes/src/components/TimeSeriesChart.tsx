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
  Legend,
);

// Helper para formatear fechas en el eje X
const formatDate = (
  isoString: string,
  viewMode: "daily" | "hourly",
): string => {
  const date = new Date(isoString);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const pad = (num: number): string => String(num).padStart(2, "0");

  if (viewMode === "hourly") {
    return `${pad(hours)}:${pad(minutes)}`;
  }
  return `${pad(day)}-${pad(month)}`;
};

// --- Nuevo componente interno para la etiqueta de estado ---
const LastUpdateBadge = ({ latestIsoTime }: { latestIsoTime: string }) => {
  const timestamp = new Date(latestIsoTime);
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  let badgeClass = "bg-danger text-white";
  if (diffMinutes <= 10) badgeClass = "bg-success text-white";
  else if (diffMinutes <= 20) badgeClass = "bg-warning text-dark";

  // Formato corto para la etiqueta: HH:mm
  const formattedTime = timestamp.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <span
      className={`badge rounded-pill ${badgeClass} position-absolute top-0 end-0 m-2 shadow-sm`}
      style={{ fontSize: "0.75rem", zIndex: 10 }}
      title={`Última actualización: ${timestamp.toLocaleString()}`}
    >
      Act: {formattedTime}
    </span>
  );
};

interface ExtendedTimeSeriesChartProps extends TimeSeriesChartProps {
  chartType?: "bar" | "line";
  viewMode?: "daily" | "hourly";
  showLastUpdate?: boolean; // <--- Nueva prop
}

const TimeSeriesChart: React.FC<ExtendedTimeSeriesChartProps> = ({
  title,
  metrics,
  barColor,
  chartType = "bar",
  viewMode = "daily",
  showLastUpdate = false, // Por defecto desactivado
}) => {
  // Lógica para encontrar la fecha más reciente para la etiqueta
  const getLatestMetricTime = (): string | null => {
    if (!metrics || metrics.length === 0) return null;

    // Reducimos para encontrar la fecha máxima (el array podría no venir ordenado)
    const maxTime = metrics.reduce((max, current) => {
      return new Date(current.time) > new Date(max) ? current.time : max;
    }, metrics[0].time);

    return maxTime;
  };

  const latestTime = getLatestMetricTime();

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

  const createBarData = (): ChartData<"bar", number[], string> => ({
    labels: metrics.map((m) => formatDate(m.time, viewMode!)),
    datasets: [
      {
        label: title,
        data: metrics.map((m) =>
          title === "Nivel Pozo" ? m.value / 10 : m.value,
        ),
        backgroundColor: barColor,
        barPercentage: 0.8,
        categoryPercentage: 1.0,
      },
    ],
  });

  const createLineData = (): ChartData<"line", number[], string> => ({
    labels: metrics.map((m) => formatDate(m.time, viewMode!)),
    datasets: [
      {
        label: title,
        data: metrics.map((m) =>
          title === "Nivel Pozo" ? m.value / 10 : m.value,
        ),
        borderColor: barColor,
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      },
    ],
  });

  return (
    <div className="card p-2 position-relative">
      {/* Renderizado condicional de la etiqueta */}
      {showLastUpdate && latestTime && (
        <LastUpdateBadge latestIsoTime={latestTime} />
      )}

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
