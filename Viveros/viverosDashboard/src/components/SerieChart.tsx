import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { ChartOptions, ScriptableLineSegmentContext } from "chart.js";
import { COLOR_GRILLA, ejeTiempo, fechaHoraTooltip, pluginBandas, type Banda } from "../lib/charts";
import { COLOR_ESTADO } from "../lib/estados";
import { conUnidad, formatoNumero } from "../lib/formato";

interface SerieChartProps {
  titulo: string;
  puntos: { ms: number; v: number | null }[];
  desde: number;
  hasta: number;
  rangoMin: number | null;
  rangoMax: number | null;
  color: string;
  unidad: string;
  decimales: number;
  topeMin: number;
  /** VPD: franjas de color bajo / óptimo / alto en vez de una sola franja verde. */
  franjasVpd?: boolean;
  altura?: number;
}

const fuera = (v: number | null, min: number | null, max: number | null) =>
  v !== null && ((min !== null && v < min) || (max !== null && v > max));

/**
 * Serie de una variable en el tiempo real (eje en hora Chile), con el rango permitido
 * sombreado, la línea en rojo donde sale del rango y cortes donde faltan datos.
 */
function SerieChart({
  titulo,
  puntos,
  desde,
  hasta,
  rangoMin,
  rangoMax,
  color,
  unidad,
  decimales,
  topeMin,
  franjasVpd = false,
  altura = 220,
}: SerieChartProps) {
  const datos = useMemo(() => {
    const salida: { x: number; y: number | null }[] = [];
    let anterior: number | null = null;
    for (const p of puntos) {
      if (p.v === null) continue;
      if (anterior !== null && p.ms - anterior > topeMin * 60000) salida.push({ x: anterior + 1, y: null });
      salida.push({ x: p.ms, y: p.v });
      anterior = p.ms;
    }
    return salida;
  }, [puntos, topeMin]);

  const hayRango = rangoMin !== null || rangoMax !== null;
  const bandas: Banda[] = !hayRango
    ? []
    : franjasVpd
      ? [
          { desde: null, hasta: rangoMin, color: "rgba(47,111,223,0.08)" },
          { desde: rangoMin, hasta: rangoMax, color: "rgba(25,135,84,0.12)", borde: "rgba(25,135,84,0.6)" },
          { desde: rangoMax, hasta: null, color: "rgba(220,53,69,0.08)" },
        ]
      : [{ desde: rangoMin, hasta: rangoMax, color: "rgba(25,135,84,0.12)", borde: "rgba(25,135,84,0.6)" }];

  const opciones: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    normalized: true,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: { display: false },
      bandas: { lista: bandas },
      tooltip: {
        callbacks: {
          title: (items) => (items.length ? fechaHoraTooltip(items[0].parsed.x ?? 0) : ""),
          label: (item) => {
            const v = item.parsed.y ?? 0;
            const estado = hayRango && !franjasVpd ? (fuera(v, rangoMin, rangoMax) ? " · fuera de rango" : " · en rango") : "";
            return `${titulo}: ${conUnidad(v, unidad, decimales)}${estado}`;
          },
        },
      },
    },
    scales: {
      x: ejeTiempo(desde, hasta),
      y: {
        grace: "8%",
        suggestedMin: rangoMin ?? undefined,
        suggestedMax: rangoMax ?? undefined,
        grid: { color: COLOR_GRILLA },
        border: { display: false },
        title: { display: true, text: unidad },
        ticks: { callback: (v) => formatoNumero(Number(v), decimales === 2 ? 2 : 0) },
      },
    },
  };

  if (datos.length < 2) {
    return (
      <div className="d-flex align-items-center justify-content-center text-body-secondary small" style={{ height: altura }}>
        Sin datos en el período seleccionado.
      </div>
    );
  }

  return (
    <div style={{ height: altura }}>
      <Line
        plugins={[pluginBandas]}
        options={opciones}
        data={{
          datasets: [
            {
              label: titulo,
              data: datos,
              borderColor: color,
              backgroundColor: color,
              borderWidth: 1.75,
              pointRadius: 0,
              pointHoverRadius: 3,
              tension: 0.2,
              spanGaps: false,
              segment: franjasVpd || !hayRango
                ? undefined
                : {
                    borderColor: (ctx: ScriptableLineSegmentContext) =>
                      fuera(ctx.p0.parsed.y, rangoMin, rangoMax) || fuera(ctx.p1.parsed.y, rangoMin, rangoMax)
                        ? COLOR_ESTADO.fuera
                        : undefined,
                  },
            },
          ],
        }}
      />
    </div>
  );
}

export default SerieChart;
