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
  initialData: Metric[] | Record<string, Metric[]>;
  type:
    | "nivel"
    | "caudal"
    | "horometro"
    | "totalizador"
    | "voltaje"
    | "voltaje-neutro"
    | "corriente";
  date?: string;
  nivelMax?: number; // Opcional, por defecto 3 en la lógica
  nivelAlarma?: number; // Opcional
  fetchEndpoint?: string; // Para consultas por fecha
  divisor?: number; // Para transformar valores de entrada
  className?: string; // Para clases extra
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
  className = "",
}: GraphCardProps) {
  const [currentData, setCurrentData] = useState<
    Metric[] | Record<string, Metric[]>
  >(initialData);
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

  const isMultiDataset = !Array.isArray(currentData);
  const typeIsLine =
    type === "nivel" ||
    type === "caudal" ||
    type === "voltaje" ||
    type === "voltaje-neutro" ||
    type === "corriente";
  const typeIsBar = type === "horometro" || type === "totalizador";

  let labels: string[] = [];
  let datasets: any[] = [];

  if (!isMultiDataset) {
    const dataArray = currentData as Metric[];
    labels = dataArray.map((d) => {
      if (typeIsLine) {
        return new Date(d.time).toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        return new Date(d.time).toISOString().split("T")[0];
      }
    });

    const values = dataArray.map((d) => d.value / divisor);

    const mainDataset = {
      label: chartLabel,
      data: values,
      backgroundColor: "rgba(13, 110, 253, 0.6)",
      borderColor: "rgba(13, 110, 253, 1)",
      borderWidth: typeIsBar ? 1 : 2,
      tension: typeIsLine ? 0.5 : undefined,
      pointRadius: typeIsLine ? 3 : undefined,
      pointBackgroundColor: typeIsLine ? "transparent" : undefined,
      pointBorderColor: typeIsLine ? "transparent" : undefined,
    };
    datasets.push(mainDataset);

    if (nivelAlarma !== undefined) {
      datasets.push({
        label: "Nivel de alarma",
        data: Array(values.length).fill(nivelAlarma),
        borderColor: "rgba(255, 0, 0, 0.7)",
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [4, 4],
        type: "line" as const,
      });
    }
  } else {
    const dataRecord = currentData as Record<string, Metric[]>;
    const keys = Object.keys(dataRecord);
    const firstKey = keys.find(
      (key) => dataRecord[key] && dataRecord[key].length > 0,
    );

    labels = firstKey
      ? dataRecord[firstKey].map((d) => {
          if (typeIsLine) {
            return new Date(d.time).toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            });
          } else {
            return new Date(d.time).toISOString().split("T")[0];
          }
        })
      : [];

    const borderColors = [
      "rgba(255, 0, 0, 1)",
      "rgba(0, 180, 0, 1)",
      "rgba(0, 0, 255, 1)",
    ];

    const bgColors = [
      "rgba(255, 0, 0, 0.6)",
      "rgba(0, 180, 0, 0.6)",
      "rgba(0, 0, 255, 0.6)",
    ];

    datasets = keys.map((key, index) => {
      return {
        label: key.toUpperCase(),
        data: dataRecord[key].map((d) => d.value / divisor),
        backgroundColor: bgColors[index % bgColors.length],
        borderColor: borderColors[index % borderColors.length],
        borderWidth: 2,
        tension: typeIsLine ? 0.5 : undefined,
        pointRadius: 0,
        pointHitRadius: 10,
        pointBackgroundColor: "transparent",
        pointBorderColor: "transparent",
      };
    });
  }

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
        display: typeIsBar || isMultiDataset,
        text: typeIsBar || isMultiDataset ? chartLabel : undefined,
      },
      tooltip: {
        mode: isMultiDataset ? "index" : "nearest",
        intersect: !isMultiDataset,
        callbacks: {
          label: (context: any) => {
            const val = context.raw as number;
            if (type === "horometro" && context.datasetIndex === 0) {
              return `${context.dataset.label}: ${minutesToHHMM(val)}`;
            }
            return `${context.dataset.label}: ${val}`;
          },
        },
      },
    },
    hover: isMultiDataset
      ? {
          mode: "index",
          intersect: false,
        }
      : undefined,
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
          (type === "nivel" || type === "caudal") && nivelMax
            ? nivelMax
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
      className={`mt-2 mb-2 mt-lg-0 mb-lg-0 ${isOpen ? "show" : "collapse-card"} ${className}`}
    >
      <Card>
        <CardBody title={`Detalle ${title}`} date={date} />
        <div
          style={{
            height: typeIsLine ? "205px" : "230px",
            position: "relative",
            marginTop: typeIsLine ? "-25px" : "0px",
          }}
        >
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
          {typeIsBar ? (
            <Bar data={chartData as any} options={options} />
          ) : (
            <Line data={chartData as any} options={options} />
          )}
        </div>
        {typeIsLine && (
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
