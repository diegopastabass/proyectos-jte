import { apiUrl, type Metric } from "../balsas";

export const fetchApi = async <T,>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> => {
  const res = await fetch(apiUrl(endpoint, params));
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${endpoint}`);
  return res.json();
};

// Fetch con Caché. La clave lleva "balsas" porque todos los sitios comparten origen
// (app.jteanalytics.cl) y, por lo tanto, localStorage.
export const fetchWithCache = async (
  endpoint: string,
  params: Record<string, string>,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_balsas_${endpoint}_${new URLSearchParams(params)}`;
  const cached = localStorage.getItem(cacheKey);
  let data: Metric[] = cached ? JSON.parse(cached) : [];

  let startStr = "";
  if (data.length > 0) {
    startStr = data[data.length - 1].time.split("T")[0];
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    startStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
    }).format(d);
  }

  const res = await fetch(apiUrl(endpoint, { ...params, start: startStr, end: endStr }));
  if (!res.ok) {
    console.error(`Error ${res.status} al cargar ${endpoint}`);
    return data;
  }
  const newData: Metric[] = await res.json();

  const newDates = new Set(newData.map((d) => d.time.split("T")[0]));
  data = data.filter((d) => !newDates.has(d.time.split("T")[0]));
  const merged = [...data, ...newData];

  const toCache = merged.filter((d) => d.time.split("T")[0] !== endStr);
  localStorage.setItem(cacheKey, JSON.stringify(toCache));

  return merged;
};
