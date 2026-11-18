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
} from "chart.js";

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

/** Eje Y con título de unidad, desde 0 y con números en formato chileno. */
export const ejeY = (unidad: string) => ({
  beginAtZero: true,
  grid: { color: COLOR_GRILLA },
  border: { display: false },
  title: { display: true, text: unidad },
  ticks: {
    callback: (v: number | string) => Number(v).toLocaleString("es-CL"),
  },
});
