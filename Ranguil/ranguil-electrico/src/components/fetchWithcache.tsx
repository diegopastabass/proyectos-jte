import type { Metric } from "../types";

// Días que se muestran en los gráficos (hoy + los 14 anteriores). El caché en
// localStorage conserva todo el historial; solo se recorta lo que se devuelve.
export const CHART_DAYS = 15;

const dayOf = (m: Metric) => m.time.split("T")[0];

// Primer día (YYYY-MM-DD) de la ventana de CHART_DAYS que termina en endStr
const windowStart = (endStr: string): string => {
  const d = new Date(`${endStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (CHART_DAYS - 1));
  return d.toISOString().split("T")[0];
};

export const limitToChartDays = (data: Metric[], endStr: string): Metric[] => {
  const start = windowStart(endStr);
  return data.filter((d) => dayOf(d) >= start);
};

// Fetch con Caché
export const fetchWithCache = async (
  endpoint: string,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_ranguil_electrico${endpoint}`;
  const cached = localStorage.getItem(cacheKey);
  let data: Metric[] = cached ? JSON.parse(cached) : [];

  let startStr = "";
  if (data.length > 0) {
    startStr = dayOf(data[data.length - 1]);
  } else {
    startStr = windowStart(endStr);
  }

  const res = await fetch(
    `https://app.jteanalytics.cl/ranguil/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  const newData: Metric[] = await res.json();

  const newDates = new Set(newData.map(dayOf));
  data = data.filter((d) => !newDates.has(dayOf(d)));
  const merged = [...data, ...newData];

  const toCache = merged.filter((d) => dayOf(d) !== endStr);
  localStorage.setItem(cacheKey, JSON.stringify(toCache));

  return limitToChartDays(merged, endStr);
};
