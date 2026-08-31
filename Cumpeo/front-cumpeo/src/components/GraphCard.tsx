import { useState, useEffect } from "react";
import Card, { CardBody } from "./Card";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Line, Bar } from "react-chartjs-2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
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
  const isTimeChart = type === "nivel" || type === "caudal";

  // Parsear timestamp como hora local, sin conversión de zona horaria.
  // Los datos del API ya vienen con la hora correcta de Chile.
  const parseAsLocal = (timeStr: string): number => {
    const stripped = timeStr.replace(/Z|[+-]\d{2}:\d{2}$/i, "");
    return new Date(stripped).getTime();
  };

  const labels = isTimeChart
    ? [] // No se usan labels con TimeScale, los datos llevan su timestamp
    : currentData.map((d) => new Date(d.time).toISOString().split("T")[0]);

  const values = isTimeChart
    ? currentData.map((d) => ({
        x: parseAsLocal(d.time),
        y: d.value / divisor,
      }))
    : currentData.map((d) => d.value / divisor);

  // Dataset de Alarma (solo aplica si hay nivelAlarma y es línea)
  const alarmaDataset =
    nivelAlarma !== undefined
      ? {
          label: "Nivel de alarma",
          data: isTimeChart && Array.isArray(values)
            ? (values as { x: number; y: number }[]).map((v) => ({
                x: v.x,
                y: nivelAlarma / divisor,
              }))
            : Array(values.length).fill(nivelAlarma / divisor),
          borderColor: "rgba(255, 0, 0, 0.7)",
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [4, 4],
          type: "line" as const,
        }
      : null;

  const mainDataset = {
    label: chartLabel,
    data: values,
    backgroundColor: "rgba(13, 110, 253, 0.6)",
    borderColor: "rgba(13, 110, 253, 1)",
    borderWidth: type === "horometro" || type === "totalizador" ? 1 : 2,
    tension: isTimeChart ? 0.3 : undefined,
    pointRadius: isTimeChart ? 0 : undefined,
    pointHoverRadius: isTimeChart ? 4 : undefined,
    pointHoverBackgroundColor: isTimeChart
      ? "rgba(13, 110, 253, 1)"
      : undefined,
    pointHoverBorderColor: isTimeChart ? "#fff" : undefined,
  };

  const chartData = {
    ...(isTimeChart ? {} : { labels }),
    datasets: [mainDataset, ...(alarmaDataset ? [alarmaDataset] : [])],
  };

  const isBarChart = type === "horometro" || type === "totalizador";

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
        display: isBarChart,
        text: isBarChart ? chartLabel : undefined, // Para bars muestran título encima
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const raw = context.raw;
            const val = typeof raw === "object" && raw !== null ? raw.y : raw;
            if (type === "horometro" && context.datasetIndex === 0) {
              return `${context.dataset.label}: ${minutesToHHMM(val)}`;
            }
            return `${context.dataset.label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: isTimeChart
        ? {
            type: "time" as const,
            time: {
              unit: "hour" as const,
              stepSize: 3,
              displayFormats: {
                hour: "HH:mm",
              },
              tooltipFormat: "HH:mm",
            },
            ticks: {
              color: "#555",
              maxRotation: 0,
              source: "auto" as const,
            },
            grid: {
              display: true,
              color: "rgba(0,0,0,0.05)",
            },
          }
        : {
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
            <Bar data={chartData as any} options={options} />
          ) : (
            <Line data={chartData as any} options={options} />
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
