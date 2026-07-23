import { useState, useEffect } from "react";
import Card, { CardBody } from "./Card";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
  type ChartOptions,
  type TooltipItem,
  type ChartData,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
);

interface Metric {
  value: number;
  time: string;
}

export interface GraphCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  initialData: Metric[];
  type: "nivel" | "caudal" | "horometro" | "totalizador";
  date?: string;
  nivelMax?: number; // Opcional, por defecto 3 en la lógica
  nivelAlarma?: number; // Opcional
  fetchEndpoint?: string; // Para consultas por fecha
  divisor?: number; // Para transformar valores de entrada
}

const minutesToHHMM = (mins: number): string => {
  const hours = Math.floor(mins / 60);
  const minutes = Math.round(mins % 60); // Redondear minutos para evitar decimales
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
};

function GraphCard({
  isOpen,
  title,
  chartLabel,
  initialData,
  type,
  date,
  nivelMax = 3,
  nivelAlarma,
  fetchEndpoint,
  divisor = 1,
}: GraphCardProps) {
  const [currentData, setCurrentData] = useState<Metric[]>(initialData);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sincronizar initialData con currentData si no hay una fecha seleccionada
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
            `${fetchEndpoint}?start=${formattedDate}&end=${formattedDate}`,
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

  // Procesamiento de datos y etiquetas según el tipo
  const safeData = Array.isArray(currentData) ? currentData : [];

  const labels = safeData.map((d) => {
    if (type === "nivel" || type === "caudal") {
      return new Date(d.time).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return new Date(d.time).toISOString().split("T")[0];
    }
  });

  const values = safeData.map((d) => d.value / divisor);

  // Dataset de Alarma (solo aplica si hay nivelAlarma y es línea)
  const alarmaDataset =
    nivelAlarma !== undefined
      ? {
          label: "Nivel de alarma",
          data: Array(values.length).fill(nivelAlarma / divisor),
          borderColor: "rgba(255, 0, 0, 0.7)",
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [4, 4],
          type: "line" as const, // Especificar line explícitamente si alguna vez se mezclan
        }
      : null;

  const mainDataset = {
    label: chartLabel,
    data: values,
    backgroundColor: "rgba(13, 110, 253, 0.6)",
    borderColor: "rgba(13, 110, 253, 1)",
    borderWidth: type === "horometro" || type === "totalizador" ? 1 : 2,
    tension: type === "nivel" || type === "caudal" ? 0.5 : undefined,
    pointRadius: type === "nivel" || type === "caudal" ? 3 : undefined,
    pointBackgroundColor:
      type === "nivel" || type === "caudal" ? "transparent" : undefined,
    pointBorderColor:
      type === "nivel" || type === "caudal" ? "transparent" : undefined,
  };

  const chartData = {
    labels,
    datasets: [mainDataset, ...(alarmaDataset ? [alarmaDataset] : [])],
  };

  const isBarChart = type === "horometro" || type === "totalizador";

  const options: ChartOptions<"line" | "bar"> = {
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
        display: isBarChart,
        text: isBarChart ? chartLabel : undefined, // Para bars muestran título encima
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"line" | "bar">) => {
            const val = context.raw as number;
            if (type === "horometro" && context.datasetIndex === 0) {
              return `${context.dataset.label}: ${minutesToHHMM(val)}`;
            }
            return `${context.dataset.label}: ${val}`;
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
        min: type === "nivel" ? 0 : undefined,
        max:
          type === "nivel" || type === "caudal"
            ? nivelMax / divisor
            : undefined,
        ticks: {
          color: "#555",
          callback: function (value: number | string) {
            if (type === "horometro") {
              return minutesToHHMM(Number(value));
            }
            return value;
          },
        },
      },
    },
  };

  return (
    <div
      className={`mt-2 mb-2 mt-lg-0 mb-lg-0 ${isOpen ? "show" : "collapse-card"}`}
    >
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
          {isBarChart ? (
            <Bar data={chartData as ChartData<"bar">} options={options as ChartOptions<"bar">} />
          ) : (
            <Line data={chartData as ChartData<"line">} options={options as ChartOptions<"line">} />
          )}
        </div>
        {(type === "nivel" || type === "caudal") && (
          <div className="d-flex justify-content-center align-items-center p-2 border-top">
            <span className="me-2 text-muted" style={{ fontSize: "0.9rem" }}>
              Consultar fecha:
            </span>
            <DatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="yyyy-MM-dd"
              className="form-control form-control-sm"
              placeholderText="Seleccione fecha"
              isClearable
            />
          </div>
        )}
      </Card>
    </div>
  );
}

export default GraphCard;
