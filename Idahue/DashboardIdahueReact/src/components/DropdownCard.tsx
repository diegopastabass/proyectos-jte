import Card, { CardBody } from "./Card";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
);

interface DropdownCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  divisor?: number;
  data: {
    time: string;
    value: number;
  }[];
  className?: string;
  date?: string;
  nivelMax?: number; // si no viene, usar 3
  nivelAlarma?: number; // opcional
}

function DropdownCard({
  isOpen,
  title,
  data,
  chartLabel,
  date,
  nivelMax = 3,
  nivelAlarma,
  divisor = 1,
}: DropdownCardProps) {
  const labels = data.map((d) =>
    new Date(d.time).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  const values = data.map((d) => d.value / divisor);

  const alarmaDataset =
    nivelAlarma !== undefined
      ? {
          label: "Nivel de alarma",
          data: Array(values.length).fill(nivelAlarma),
          borderColor: "rgba(255, 0, 0, 0.7)",
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [4, 4],
        }
      : null;

  const chartData = {
    labels,
    datasets: [
      {
        label: chartLabel,
        data: values,
        backgroundColor: "rgba(13, 110, 253, 0.6)",
        borderColor: "rgba(13, 110, 253, 1)",
        borderWidth: 2,
        tension: 0.5,
        pointRadius: 3,
        pointBackgroundColor: "transparent",
        pointBorderColor: "transparent",
      },
      ...(alarmaDataset ? [alarmaDataset] : []),
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
        min: 0, // nivel mínimo fijo
        max: nivelMax, // máximo dinámico o default 3
        ticks: {
          color: "#555",
        },
      },
    },
  };

  return (
    <div
      className={`mt-lg-0 mb-lg-0 mt-2 mb-2 ${
        isOpen ? "show" : "collapse-card"
      }`}
    >
      <Card>
        <CardBody title={`Detalle ${title}`} date={date}></CardBody>
        <div style={{ height: "230px" }}>
          <Line data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCard;
