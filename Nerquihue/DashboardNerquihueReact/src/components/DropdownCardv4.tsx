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

interface DropdownCardv4Props {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  data: Record<string, { time: string; value: number }[]>;
  date?: string;
  divisor?: number;
  chartHeight?: string | number;
}

function DropdownCardv4({
  isOpen,
  title,
  chartLabel,
  data,
  date,
  divisor = 1,
  chartHeight = "230px",
}: DropdownCardv4Props) {
  const keys = Object.keys(data);
  const firstKey = keys.find((key) => data[key] && data[key].length > 0);

  const labels = firstKey
    ? data[firstKey].map((d) =>
        new Date(d.time).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      )
    : [];

  const borderColors = [
    "rgba(255, 0, 0, 1)", // Rojo
    "rgba(0, 180, 0, 1)", // Verde
    "rgba(0, 0, 255, 1)", // Azul
  ];

  const bgColors = [
    "rgba(255, 0, 0, 0.6)",
    "rgba(0, 180, 0, 0.6)",
    "rgba(0, 0, 255, 0.6)",
  ];

  const datasets = keys.map((key, index) => {
    return {
      label: key.toUpperCase(),
      data: data[key].map((d) => d.value / divisor),
      backgroundColor: bgColors[index % bgColors.length],
      borderColor: borderColors[index % borderColors.length],
      borderWidth: 2,
      tension: 0.5,
      pointRadius: 0,
      pointHitRadius: 10,
      pointBackgroundColor: "transparent",
      pointBorderColor: "transparent",
    };
  });

  const chartData = {
    labels,
    datasets,
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
        mode: "index" as const,
        intersect: false,
      },
    },
    hover: {
      mode: "index" as const,
      intersect: false,
    },
    scales: {
      x: {
        ticks: {
          color: "#555",
        },
      },
      y: {
        beginAtZero: true, // Esto puede hacer que el gráfico pierda detalle si los voltajes varían poco alrededor de 220V. Se puede ajustar a false si prefieren ver la variación más de cerca.
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
        <div style={{ height: chartHeight }}>
          <Line data={chartData} options={options} />
        </div>
      </Card>
    </div>
  );
}

export default DropdownCardv4;
