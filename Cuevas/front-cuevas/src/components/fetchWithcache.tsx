interface Metric {
  value: number;
  time: string;
}

export const API_BASE = "https://app.jteanalytics.cl/cuevas";

// GET al API que falla ante respuestas HTTP de error, para no tratar un
// { success: false, ... } como si fuera una serie de datos.
export const fetchApi = async <T,>(path: string, dayStr?: string): Promise<T> => {
  const query = dayStr ? `?start=${dayStr}&end=${dayStr}` : "";
  const res = await fetch(`${API_BASE}/${path}${query}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

const readCache = (key: string): Metric[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCache = (key: string, data: Metric[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Cuota llena o almacenamiento bloqueado: se sigue sin caché
  }
};

// Fetch con caché para métricas DIARIAS (una muestra por día: totalizador,
// horómetro). No usar con series de alta frecuencia como voltaje o corriente:
// acumularían días de muestras crudas en localStorage.
export const fetchWithCache = async (
  endpoint: string,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_cuevas_${endpoint}`;
  let data = readCache(cacheKey);

  let startStr: string;
  if (data.length > 0) {
    startStr = data[data.length - 1].time.split("T")[0];
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    startStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
    }).format(d);
  }

  const res = await fetch(
    `${API_BASE}/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
  const newData: Metric[] = await res.json();

  const newDates = new Set(newData.map((d) => d.time.split("T")[0]));
  data = data.filter((d) => !newDates.has(d.time.split("T")[0]));
  const merged = [...data, ...newData];

  writeCache(
    cacheKey,
    merged.filter((d) => d.time.split("T")[0] !== endStr),
  );

  return merged;
};
