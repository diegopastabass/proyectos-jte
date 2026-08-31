import { useState, useEffect } from "react";
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
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
);

interface Metric {
  value: number;
  time: string;
}

export interface MultiLineGraphCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  initialData: Record<string, Metric[]>;
  date?: string;
  fetchEndpoint?: string;
  divisor?: number;
}

function MultiLineGraphCard({
  isOpen,
  title,
  chartLabel,
  initialData,
  date,
  fetchEndpoint,
  divisor = 1,
}: MultiLineGraphCardProps) {
  const [currentData, setCurrentData] = useState<Record<string, Metric[]>>(initialData);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedDate) {
      setCurrentData(initialData);
    }
  }, [initialData, selectedDate]);

  useEffect(() => {
    const fetchDataByDate = async () => {
      if (selectedDate && fetchEndpoint) {
        setIsLoading(true);
        try {
          const formattedDate = format(selectedDate, "yyyy-MM-dd");
          const response = await fetch(
            `${fetchEndpoint}?start=${formattedDate}&end=${formattedDate}`
          );
          if (response.ok) {
            const data = await response.json();
            setCurrentData(data);
          } else {
            console.error("Error al obtener datos por fecha");
          }
        } catch (error) {
          console.error("Excepción al hacer fetch:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (!selectedDate) {
        setCurrentData(initialData);
      }
    };

    fetchDataByDate();
  }, [selectedDate, fetchEndpoint, initialData]);

  const keys = Object.keys(currentData);
  const firstKey = keys.find((key) => currentData[key] && currentData[key].length > 0);

  const labels = firstKey
    ? currentData[firstKey].map((d) =>
        new Date(d.time).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })
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
      data: currentData[key].map((d) => d.value / divisor),
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

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
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
        beginAtZero: true,
        ticks: {
          color: "#555",
        },
      },
    },
  };

  return (
    <div className={`mt-2 mb-2 mt-lg-0 mb-lg-0 ${isOpen ? "show" : "collapse-card"}`}>
      <Card>
        <CardBody title={`Detalle ${title}`} date={date} />
        <div style={{ height: "230px", position: "relative" }}>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                zIndex: 10,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <span>Cargando...</span>
            </div>
          )}
          <Line data={chartData as any} options={options} />
        </div>
        <div className="d-flex justify-content-center align-items-center p-2 border-top">
          <span className="me-2 text-muted" style={{ fontSize: "0.9rem" }}>Consultar fecha:</span>
          <DatePicker
            selected={selectedDate}
            onChange={(date: Date | null) => setSelectedDate(date)}
            dateFormat="yyyy-MM-dd"
            className="form-control form-control-sm"
            placeholderText="Seleccione fecha"
            isClearable
          />
        </div>
      </Card>
    </div>
  );
}

export default MultiLineGraphCard;
