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
  Title
);

interface DropdownCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  data: {
    time: string;
    value: number;
  }[];
  className?: string;
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
        backgroundColor: "rgba(13, 110, 253, 0.6)",
        borderColor: "rgba(13, 110, 253, 1)",
        borderWidth: 2,
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
    <div className={`mb-4 ${isOpen ? "show" : "collapse-card"}`}>
      <Card>
        <CardBody title={`Detalle ${title}`}></CardBody>
        <div style={{ height: "230px" }}>
          <Line data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCard;
