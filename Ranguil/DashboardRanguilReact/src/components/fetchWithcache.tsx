interface Metric {
  value: number;
  time: string;
}

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
  const cacheKey = `jte_cache_ranguil${endpoint}`;
  const cached = localStorage.getItem(cacheKey);
  let data: Metric[] = cached ? JSON.parse(cached) : [];

  let startStr = "";
  if (data.length > 0) {
    startStr = data[data.length - 1].time.split("T")[0];
  } else {
    startStr = windowStart(endStr);
  }

  const res = await fetch(
    `https://app.jteanalytics.cl/ranguil/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  const newData: Metric[] = await res.json();

  const newDates = new Set(newData.map((d) => d.time.split("T")[0]));
  data = data.filter((d) => !newDates.has(d.time.split("T")[0]));
  const merged = [...data, ...newData];

  const toCache = merged.filter((d) => d.time.split("T")[0] !== endStr);
  localStorage.setItem(cacheKey, JSON.stringify(toCache));

  return limitToChartDays(merged, endStr);
};

export const fetchWithCacheMulti = async <T extends Record<string, Metric[]>>(
  endpoint: string,
  endStr: string,
): Promise<T> => {
  const cacheKey = `jte_cache_${endpoint}`;
  const cached = localStorage.getItem(cacheKey);
  const data: Record<string, Metric[]> = cached ? JSON.parse(cached) : {};

  // Find startStr
  let startStr = "";
  const keys = Object.keys(data);
  if (keys.length > 0 && data[keys[0]] && data[keys[0]].length > 0) {
    startStr = data[keys[0]][data[keys[0]].length - 1].time.split("T")[0];
  } else {
    startStr = windowStart(endStr);
  }

  const res = await fetch(
    `https://app.jteanalytics.cl/ranguil/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  const newData: Record<string, Metric[]> = await res.json();

  const merged: Record<string, Metric[]> = {};
  const toCache: Record<string, Metric[]> = {};

  const allKeys = new Set([...Object.keys(data), ...Object.keys(newData)]);

  allKeys.forEach((k) => {
    const oldArray = data[k] || [];
    const newArray = newData[k] || [];

    const newDates = new Set(newArray.map((d) => d.time.split("T")[0]));
    const filteredOld = oldArray.filter(
      (d) => !newDates.has(d.time.split("T")[0]),
    );

    const mergedArray = [...filteredOld, ...newArray];
    merged[k] = limitToChartDays(mergedArray, endStr);

    const toCacheArray = mergedArray.filter(
      (d) => d.time.split("T")[0] !== endStr,
    );
    toCache[k] = toCacheArray;
  });

  localStorage.setItem(cacheKey, JSON.stringify(toCache));

  return merged as T;
};
