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
    time: string;
    value: number;
  }[];
}

function DropdownCardv3({
  isOpen,
  title,
  data,
  chartLabel,
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
    <div className={` ${isOpen ? "show" : "collapse-card"}`}>
      <Card>
        <CardBody title={`Detalle ${title}`} />
        <div style={{ height: "230px" }}>
          <Bar data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCardv3;
