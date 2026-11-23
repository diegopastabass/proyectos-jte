import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
  type Plugin,
  type Scale,
} from "chart.js";
import { diaChile } from "./fechas";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
);

ChartJS.defaults.font.family =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
ChartJS.defaults.color = "#6c757d";

export const COLOR_GRILLA = "rgba(108, 117, 125, 0.15)";

/** Franja horizontal sombreada entre dos valores del eje Y (null = hasta el borde). */
export interface Banda {
  desde: number | null;
  hasta: number | null;
  color: string;
  /** Línea punteada en los bordes finitos de la franja. */
  borde?: string;
}

declare module "chart.js" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType> {
    bandas?: { lista: Banda[] };
  }
}

/** Dibuja `options.plugins.bandas.lista` detrás de los datos. */
export const pluginBandas: Plugin = {
  id: "bandas",
  beforeDatasetsDraw(chart, _args, opciones) {
    const lista = (opciones as { lista?: Banda[] }).lista ?? [];
    const y = chart.scales.y;
    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    for (const b of lista) {
      const y1 = b.hasta === null ? top : Math.max(top, y.getPixelForValue(b.hasta));
      const y2 = b.desde === null ? bottom : Math.min(bottom, y.getPixelForValue(b.desde));
      if (y2 <= y1) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(left, y1, right - left, y2 - y1);
      if (b.borde) {
        ctx.strokeStyle = b.borde;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        for (const v of [b.desde, b.hasta]) {
          if (v === null) continue;
          const py = y.getPixelForValue(v);
          if (py < top || py > bottom) continue;
          ctx.beginPath();
          ctx.moveTo(left, py);
          ctx.lineTo(right, py);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  },
};

const fmtHora = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fmtDiaCorto = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  day: "2-digit",
  month: "2-digit",
});
const fmtCompleto = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const HORA = 3600_000;
const PASOS_HORAS = [1, 2, 3, 6, 12, 24];

const horaDeChile = (ms: number) => Number(fmtHora.format(ms).slice(0, 2));

/**
 * Marcas del eje X en horas redondas de Chile (no del navegador), con un paso que
 * deja como máximo ~8 marcas. Con paso de 24 h, marcas a la medianoche.
 */
export function marcasHorarias(min: number, max: number): number[] {
  const paso = PASOS_HORAS.find((h) => (max - min) / (h * HORA) <= 8) ?? 24;
  const marcas: number[] = [];
  for (let t = Math.ceil(min / HORA) * HORA; t <= max; t += HORA) {
    if (horaDeChile(t) % paso === 0) marcas.push(t);
  }
  return marcas;
}

/** "14:00", o "18-11" a la medianoche / cuando el rango abarca varios días. */
export const etiquetaMarca = (ms: number, variosDias: boolean): string =>
  variosDias && horaDeChile(ms) === 0 ? fmtDiaCorto.format(ms) : fmtHora.format(ms);

export const fechaHoraTooltip = (ms: number): string => fmtCompleto.format(ms);

/** Eje X lineal en milisegundos con marcas y etiquetas en hora de Chile. */
export function ejeTiempo(min: number, max: number) {
  const variosDias = diaChile(new Date(min)) !== diaChile(new Date(max));
  return {
    type: "linear" as const,
    min,
    max,
    grid: { color: COLOR_GRILLA },
    border: { display: false },
    afterBuildTicks: (eje: Scale) => {
      eje.ticks = marcasHorarias(eje.min, eje.max).map((value) => ({ value }));
    },
    ticks: {
      autoSkip: false,
      maxRotation: 0,
      callback: (v: number | string) => etiquetaMarca(Number(v), variosDias),
    },
  };
}
