import { Line } from "react-chartjs-2";
import type { ChartOptions, TooltipItem } from "chart.js";
import { COLOR_GRILLA, ejeY } from "../lib/charts";
import { horaChile, minutosDelDia } from "../lib/fechas";
import { formatoDuracion, formatoNumero } from "../lib/formato";
import type { Linea } from "../config";
import type { Punto } from "./types";

/** Una separación mayor que esto entre lecturas se dibuja como un corte (equipo sin datos). */
const MIN_CORTE = 25;
/** Tope de minutos que representa una lectura al sumar el tiempo con caudal. */
const MIN_POR_LECTURA = 15;

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

interface Resumen {
  max: Punto;
  min: number;
  promedio: number;
  minutosConCaudal: number;
}

function resumir(puntos: Punto[]): Resumen | null {
  if (puntos.length === 0) return null;
  let max = puntos[0];
  let min = puntos[0].value;
  let suma = 0;
  let minutosConCaudal = 0;
  puntos.forEach((p, i) => {
    if (p.value > max.value) max = p;
    min = Math.min(min, p.value);
    suma += p.value;
    if (i > 0 && p.value > 0) {
      const delta =
        (new Date(p.time).getTime() - new Date(puntos[i - 1].time).getTime()) /
        60000;
      minutosConCaudal += Math.min(Math.max(delta, 0), MIN_POR_LECTURA);
    }
  });
  return { max, min, promedio: suma / puntos.length, minutosConCaudal };
}

interface CaudalDiaChartProps {
  linea: Linea;
  puntos: Punto[];
  /** Volumen del día (m³) estimado desde el caudal, si está disponible. */
  volumen?: number;
  cargando?: boolean;
  error?: boolean;
}

function CaudalDiaChart({
  linea,
  puntos,
  volumen,
  cargando,
  error,
}: CaudalDiaChartProps) {
  const datos: { x: number; y: number | null }[] = [];
  puntos.forEach((p) => {
    const x = minutosDelDia(p.time);
    const anterior = datos.at(-1);
    if (anterior && x - anterior.x > MIN_CORTE) {
      datos.push({ x: anterior.x + 1, y: null });
    }
    // La hora repetida de abril vuelve atrás: se omite para no cruzar la línea.
    if (!anterior || x >= anterior.x) datos.push({ x, y: p.value });
  });

  const resumen = resumir(puntos);

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<"line">[]) =>
            hhmm(Number(items[0].parsed.x)),
          label: (item: TooltipItem<"line">) =>
            `${linea.nombre}: ${formatoNumero(Number(item.parsed.y), 2)} m³/h`,
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        min: 0,
        max: 1440,
        grid: { color: COLOR_GRILLA },
        border: { display: false },
        ticks: { stepSize: 120, callback: (v) => hhmm(Number(v)) },
      },
      y: ejeY("m³/h"),
    },
  };

  return (
    <div className="card h-100 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-baseline mb-2">
          <h3 className="h6 mb-0">
            <span
              className="d-inline-block rounded-circle me-2"
              style={{ width: 10, height: 10, background: linea.color }}
            />
            Caudal {linea.nombre}
          </h3>
          {puntos.length > 0 && (
            <small className="text-body-secondary">
              Último dato {horaChile(puntos[puntos.length - 1].time)}
            </small>
          )}
        </div>

        <div className="position-relative" style={{ height: 240 }}>
          {(cargando || error || puntos.length === 0) && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center bg-body bg-opacity-75 z-1 rounded">
              {cargando ? (
                <div className="spinner-border spinner-border-sm text-primary" role="status">
                  <span className="visually-hidden">Cargando…</span>
                </div>
              ) : (
                <span className="text-body-secondary">
                  {error ? "No se pudieron cargar los datos" : "Sin datos para este día"}
                </span>
              )}
            </div>
          )}
          <Line
            options={options}
            data={{
              datasets: [
                {
                  label: linea.nombre,
                  data: datos,
                  borderColor: linea.color,
                  backgroundColor: linea.relleno,
                  borderWidth: 2,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  tension: 0.25,
                  fill: true,
                  spanGaps: false,
                },
              ],
            }}
          />
        </div>

        {resumen && (
          <div className="row row-cols-2 row-cols-md-4 g-2 mt-2 small text-center">
            <Dato
              etiqueta="Máximo"
              valor={`${formatoNumero(resumen.max.value, 1)} m³/h`}
              detalle={`a las ${horaChile(resumen.max.time)}`}
            />
            <Dato
              etiqueta="Promedio"
              valor={`${formatoNumero(resumen.promedio, 1)} m³/h`}
              detalle={`mín. ${formatoNumero(resumen.min, 1)}`}
            />
            <Dato
              etiqueta="Con caudal"
              valor={formatoDuracion(resumen.minutosConCaudal)}
              detalle="tiempo con caudal > 0"
            />
            <Dato
              etiqueta="Volumen"
              valor={volumen === undefined ? "—" : `${formatoNumero(volumen, 0)} m³`}
              detalle="estimado del caudal"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
}) {
  return (
    <div className="col">
      <div className="border rounded py-1 px-2 h-100">
        <div className="text-body-secondary">{etiqueta}</div>
        <div className="fw-semibold">{valor}</div>
        <div className="text-body-tertiary" style={{ fontSize: "0.75rem" }}>
          {detalle}
        </div>
      </div>
    </div>
  );
}

export default CaudalDiaChart;
