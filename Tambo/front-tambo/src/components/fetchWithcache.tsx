import { apiUrl, type Metric } from "../tambo";

// Fetch con Caché. La clave lleva "tambo" porque Zuñiga y Tambo comparten origen
// (app.jteanalytics.cl) y, por lo tanto, localStorage.
export const fetchWithCache = async (
  endpoint: string,
  params: Record<string, string>,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_tambo_${endpoint}_${new URLSearchParams(params)}`;
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
