import Card, { CardBody } from "../components/Card";
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
  data: {
    mt_value: number;
    mt_time_2: string;
  }[];
}

function DropdownCard({ isOpen, title, data }: DropdownCardProps) {
  const labels = data.map((d) =>
    new Date(d.mt_time_2).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  const values = data.map((d) => d.mt_value);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Nivel del estanque (m)",
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
        text: `${title} - Evolución del nivel`,
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
        <CardBody title={`${title} Detalle`}></CardBody>
        <div style={{ height: "250px" }}>
          <Line data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCard;
