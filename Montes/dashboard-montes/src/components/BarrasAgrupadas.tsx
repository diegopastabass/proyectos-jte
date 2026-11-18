import { Bar } from "react-chartjs-2";
import type { ChartOptions, TooltipItem } from "chart.js";
import { COLOR_GRILLA, ejeY } from "../lib/charts";
import { formatoNumero } from "../lib/formato";

export interface SerieBarras {
  nombre: string;
  color: string;
  /** null = sin datos (no se dibuja barra, distinto de 0). */
  datos: (number | null)[];
}

interface BarrasAgrupadasProps {
  etiquetas: string[];
  series: SerieBarras[];
  unidad: string;
  decimales?: number;
  /** Título del tooltip para la categoría `indice` (por defecto, la etiqueta). */
  tituloTooltip?: (indice: number) => string;
  altura?: number;
}

function BarrasAgrupadas({
  etiquetas,
  series,
  unidad,
  decimales = 1,
  tituloTooltip,
  altura = 260,
}: BarrasAgrupadasProps) {
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<"bar">[]) =>
            tituloTooltip
              ? tituloTooltip(items[0].dataIndex)
              : String(items[0].label),
          label: (item: TooltipItem<"bar">) =>
            item.raw == null
              ? `${item.dataset.label}: sin datos`
              : `${item.dataset.label}: ${formatoNumero(Number(item.raw), decimales)} ${unidad}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: COLOR_GRILLA } },
      y: ejeY(unidad),
    },
  };

  return (
    <div style={{ height: altura }}>
      <Bar
        options={options}
        data={{
          labels: etiquetas,
          datasets: series.map((s) => ({
            label: s.nombre,
            data: s.datos,
            backgroundColor: s.color,
            borderRadius: 3,
            barPercentage: 0.9,
            categoryPercentage: 0.8,
          })),
        }}
      />
    </div>
  );
}

export default BarrasAgrupadas;
