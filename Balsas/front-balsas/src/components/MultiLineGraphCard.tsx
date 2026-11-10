import { useState, useEffect, useMemo } from "react";
import Card, { CardBody } from "./Card";
import {
  Chart as ChartJS,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import "chartjs-adapter-date-fns";
import { Line } from "react-chartjs-2";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

ChartJS.register(
  LinearScale,
  TimeScale,
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

type MultiSeries = Record<string, Metric[]>;

export interface MultiLineGraphCardProps {
  isOpen: boolean;
  title: string;
  chartLabel: string;
  initialData: MultiSeries;
  date?: string;
  fetchEndpoint?: string;
  divisor?: number;
  /** false para magnitudes lejos de cero (voltaje), donde importa ver la diferencia entre fases. */
  desdeCero?: boolean;
}

const BORDER_COLORS = [
  "rgba(255, 0, 0, 1)", // Rojo
  "rgba(0, 180, 0, 1)", // Verde
  "rgba(0, 0, 255, 1)", // Azul
];

const BG_COLORS = [
  "rgba(255, 0, 0, 0.6)",
  "rgba(0, 180, 0, 0.6)",
  "rgba(0, 0, 255, 0.6)",
];

function MultiLineGraphCard({
  isOpen,
  title,
  chartLabel,
  initialData,
  date,
  fetchEndpoint,
  divisor = 1,
  desdeCero = true,
}: MultiLineGraphCardProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateData, setDateData] = useState<MultiSeries>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Con una fecha elegida se consulta ese día; si no, se muestran los datos de hoy
  useEffect(() => {
    if (!selectedDate || !fetchEndpoint) return;

    const controller = new AbortController();
    const formattedDate = format(selectedDate, "yyyy-MM-dd");

    const fetchDataByDate = async () => {
      setIsLoading(true);
      try {
        // fetchEndpoint puede traer ya parámetros (?pozo=...)
        const url = new URL(fetchEndpoint);
        url.searchParams.set("start", formattedDate);
        url.searchParams.set("end", formattedDate);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setDateData(await response.json());
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error al obtener datos por fecha:", error);
        setDateData({});
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchDataByDate();
    return () => controller.abort();
  }, [selectedDate, fetchEndpoint]);

  const currentData = selectedDate ? dateData : initialData;

  // Cada fase tiene sus propias marcas de tiempo, por eso se grafica con {x, y}
  // sobre un eje temporal en vez de compartir las etiquetas de la primera serie.
  const datasets = useMemo(
    () =>
      Object.keys(currentData).map((key, index) => ({
        label: key.toUpperCase(),
        data: currentData[key].map((d) => ({
          x: new Date(d.time).getTime(),
          y: d.value / divisor,
        })),
        backgroundColor: BG_COLORS[index % BG_COLORS.length],
        borderColor: BORDER_COLORS[index % BORDER_COLORS.length],
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 0,
        pointHitRadius: 10,
      })),
    [currentData, divisor]
  );

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    plugins: {
      legend: { display: true, labels: { color: "#333" } },
      title: { display: true, text: chartLabel },
      tooltip: { mode: "index", intersect: false },
    },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        type: "time",
        time: {
          tooltipFormat: "dd-MM HH:mm",
          displayFormats: { minute: "HH:mm", hour: "HH:mm" },
        },
        ticks: { color: "#555", maxRotation: 0, autoSkipPadding: 20 },
      },
      y: {
        beginAtZero: desdeCero,
        ticks: { color: "#555" },
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
          <Line data={{ datasets }} options={options} />
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
