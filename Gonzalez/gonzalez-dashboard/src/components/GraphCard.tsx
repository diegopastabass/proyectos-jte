import { useState, useEffect, useMemo } from "react";
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
  nivelMax?: number;
  nivelAlarma?: number;
  fetchEndpoint?: string;
  divisor?: number;
  className?: string;
}

const minutesToHHMM = (mins: number): string => {
  const hours = Math.floor(mins / 60);
  const minutes = Math.round(mins % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/** Devuelve la fecha local en Santiago para un ISO string dado. */
const toSantiagoDateStr = (isoStr: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(
    new Date(isoStr),
  );

/** Hoy en Santiago. */
const todaySantiago = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(
    new Date(),
  );

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
  className,
}: GraphCardProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [fetchedData, setFetchedData] = useState<Metric[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isBarChart = type === "horometro" || type === "totalizador";

  // Para gráficos de línea sin fecha seleccionada → mostrar solo hoy
  const displayData = useMemo(() => {
    if (fetchedData !== null) return fetchedData; // fecha seleccionada por el usuario

    if (!isBarChart) {
      // Filtrar initialData al día de hoy en Santiago
      const today = todaySantiago();
      return initialData.filter((d) => toSantiagoDateStr(d.time) === today);
    }

    return initialData;
  }, [fetchedData, initialData, isBarChart]);

  // Resetear datos al limpiar la fecha
  useEffect(() => {
    if (!selectedDate) setFetchedData(null);
  }, [selectedDate]);

  // Fetch al seleccionar una fecha
  useEffect(() => {
    if (!selectedDate || !fetchEndpoint) return;

    const fetchDataByDate = async () => {
      setIsLoading(true);
      try {
        const formattedDate = format(selectedDate, "yyyy-MM-dd");
        const response = await fetch(
          `${fetchEndpoint}?start=${formattedDate}&end=${formattedDate}`,
        );
        if (response.ok) {
          const json: unknown = await response.json();
          setFetchedData(Array.isArray(json) ? json : []);
        } else {
          console.error(
            `GraphCard: respuesta no exitosa para ${fetchEndpoint} (${response.status})`,
          );
        }
      } catch (error) {
        console.error("GraphCard: excepción al hacer fetch:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataByDate();
  }, [selectedDate, fetchEndpoint]);

  // ── Etiquetas eje X ───────────────────────────────────────────────────────
  const rawLabels = displayData.map((d) => {
    if (isBarChart) {
      return new Date(d.time).toISOString().split("T")[0];
    }
    // Hora local Santiago
    return new Date(d.time).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Santiago",
    });
  });

  const values = displayData.map((d) => d.value / divisor);

  // ── Reducir densidad de etiquetas según cantidad de puntos ────────────────
  // Objetivo: mostrar ~12 etiquetas en el eje X máximo
  const MAX_LABELS = 12;
  const step =
    rawLabels.length > MAX_LABELS
      ? Math.ceil(rawLabels.length / MAX_LABELS)
      : 1;
  const sparseLabels = rawLabels.map((l, i) => (i % step === 0 ? l : ""));

  // ── Datasets ──────────────────────────────────────────────────────────────
  const alarmaDataset =
    nivelAlarma !== undefined && !isBarChart
      ? {
          label: "Nivel de alarma",
          data: Array(values.length).fill(nivelAlarma / divisor),
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
    borderWidth: isBarChart ? 1 : 2,
    tension: !isBarChart ? 0.5 : undefined,
    pointRadius: !isBarChart ? 0 : undefined, // sin puntos para no saturar
    pointHoverRadius: !isBarChart ? 4 : undefined,
  };

  const chartData = {
    labels: sparseLabels,
    datasets: [mainDataset, ...(alarmaDataset ? [alarmaDataset] : [])],
  };

  // ── Opciones ──────────────────────────────────────────────────────────────
  const options: Parameters<typeof Line>[0]["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: true,
        labels: { color: "#333" },
      },
      title: {
        display: isBarChart,
        text: isBarChart ? chartLabel : undefined,
      },
      tooltip: {
        callbacks: {
          // Tooltip siempre muestra la etiqueta real (sin reducción)
          title: (items) => rawLabels[items[0].dataIndex] ?? "",
          label: (context) => {
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
          maxRotation: 45,
          autoSkip: false, // controlamos nosotros qué mostrar
        },
      },
      y: {
        beginAtZero: true,
        min: !isBarChart ? 0 : undefined,
        max: !isBarChart ? nivelMax / divisor : undefined,
        ticks: {
          color: "#555",
          callback: (value) => {
            if (type === "horometro") return minutesToHHMM(Number(value));
            return value;
          },
        },
      },
    },
  };

  const showDatePicker = !isBarChart && !!fetchEndpoint;

  return (
    <div
      className={`mt-2 mb-2 mt-lg-0 mb-lg-0 collapse-card ${isOpen ? "show" : ""} ${className ?? ""}`}
    >
      <Card>
        <CardBody title={`Detalle ${title}`} date={date} />
        <div style={{ height: "230px", position: "relative" }}>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(255,255,255,0.85)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
                borderRadius: "0.375rem",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  border: "3px solid #dee2e6",
                  borderTopColor: "#0d6efd",
                  borderRadius: "50%",
                  animation: "graph-spin 0.7s linear infinite",
                }}
              />
              <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>Cargando...</span>
            </div>
          )}
          {isBarChart ? (
            <Bar
              data={chartData as Parameters<typeof Bar>[0]["data"]}
              options={options as Parameters<typeof Bar>[0]["options"]}
            />
          ) : (
            <Line
              data={chartData as Parameters<typeof Line>[0]["data"]}
              options={options}
            />
          )}
        </div>
        {showDatePicker && (
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
