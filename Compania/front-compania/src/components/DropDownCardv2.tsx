import Card, { CardBody } from "./Card";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar } from "react-chartjs-2";
// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title
);

interface Metric {
  value: number;
  time: string;
}

interface DropdownCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  data: Metric[];
  date?: string;
}

const minutesToHHMM = (mins: number): string => {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};

function DropdownCardv2({
  isOpen,
  title,
  data,
  chartLabel,
  date,
}: DropdownCardProps) {
  const labels = data.map((d) => new Date(d.time).toISOString().split("T")[0]);
  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: chartLabel,
        data: values,
        backgroundColor: "rgba(13, 110, 253, 0.6)",
        borderColor: "rgba(13, 110, 253, 1)",
        borderWidth: 1,
        tension: 0.5,
        pointRadius: 3,
        pointBackgroundColor: "transparent",
        pointBorderColor: "transparent",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "#333",
        },
      },
      title: {
        display: true,
        text: chartLabel,
      },
      tooltip: {
        callbacks: {
          label: (context: import("chart.js").TooltipItem<"bar">) => {
            const minutes = context.raw as number;
            return `${context.dataset.label}: ${minutesToHHMM(minutes)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#555",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#555",
          callback: function (value: number | string) {
            return minutesToHHMM(Number(value));
          },
        },
      },
    },
  };

  return (
    <div
      className={`mt-2 mb-2 mt-lg-0 mb-lg-0 ${
        isOpen ? "show" : "collapse-card"
      }`}
    >
      <Card>
        <CardBody title={`Detalle ${title}`} date={date} />
        <div style={{ height: "230px" }}>
          <Bar data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCardv2;
