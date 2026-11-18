interface Metric {
  value: number;
  time: string;
}

const readCache = (key: string): Metric[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Metric[]) : [];
  } catch {
    return [];
  }
};

// Fetch con Caché
export const fetchWithCache = async (
  endpoint: string,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_cumpeo${endpoint}`;
  let data = readCache(cacheKey);

  let startStr: string;
  if (data.length > 0) {
    // Se vuelve a pedir el último día cacheado por si estaba incompleto
    startStr = data[data.length - 1].time.split("T")[0];
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    startStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
    }).format(d);
  }

  const res = await fetch(
    `https://app.jteanalytics.cl/cumpeo/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${endpoint}`);
  const newData: unknown = await res.json();
  if (!Array.isArray(newData)) throw new Error(`Respuesta inválida en ${endpoint}`);

  const newDates = new Set((newData as Metric[]).map((d) => d.time.split("T")[0]));
  data = data.filter((d) => !newDates.has(d.time.split("T")[0]));
  const merged = [...data, ...(newData as Metric[])];

  // Los últimos dos días pueden estar incompletos: no se persisten
  const lastDays = new Set(merged.slice(-2).map((d) => d.time.split("T")[0]));
  const toCache = merged.filter(
    (d) => d.time.split("T")[0] !== endStr && !lastDays.has(d.time.split("T")[0]),
  );
  try {
    localStorage.setItem(cacheKey, JSON.stringify(toCache));
  } catch {
    // almacenamiento lleno o bloqueado: se sigue sin caché
  }

  return merged;
};
