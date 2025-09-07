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

interface DropdownCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  data: {
    key: string; // fecha u otro identificador
    value: number; // minutos
  }[];
}

// Función utilitaria para convertir minutos a HH:MM
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
}: DropdownCardProps) {
  const labels = data.map((d) => new Date(d.key).toISOString().split("T")[0]);
  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: chartLabel,
        data: values, // siguen en minutos
        backgroundColor: "rgba(13, 110, 253, 0.6)",
        borderColor: "rgba(13, 110, 253, 1)",
        borderWidth: 1,
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
    <div className={`collapse-card ${isOpen ? "show" : ""}`}>
      <Card>
        <CardBody title={`Detalle ${title}`} />
        <div style={{ height: "250px" }}>
          <Bar data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCardv2;
