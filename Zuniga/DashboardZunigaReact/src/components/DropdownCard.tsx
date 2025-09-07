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

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
);

interface DropdownCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  data: {
    value: number;
    time: string;
  }[];
}

function DropdownCard({ isOpen, title, data, chartLabel }: DropdownCardProps) {
  const labels = data.map((d) =>
    new Date(d.time).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  const values = data.map((d) => d.value);

  const chartData = {
    labels,
    datasets: [
      {
        label: chartLabel,
        data: values,
        borderColor: "rgba(13, 110, 253, 1)",
        backgroundColor: "rgba(13, 110, 253, 0.2)",
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: "rgba(13, 110, 253, 1)",
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
        },
      },
    },
  };

  return (
    <div className={`collapse-card ${isOpen ? "show" : ""}`}>
      <Card>
        <CardBody title={`Detalle ${title}`}></CardBody>
        <div style={{ height: "250px" }}>
          <Line data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCard;
