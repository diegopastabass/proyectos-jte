interface Metric {
  value: number;
  time: string;
}
// Fetch con Caché
export const fetchWithCache = async (
  endpoint: string,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_auquinco${endpoint}`;
  const cached = localStorage.getItem(cacheKey);
  let data: Metric[] = [];

  // Validar que los datos cacheados sean un array válido
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        data = parsed;
      } else {
        console.warn(`Cache corrupta para ${cacheKey}, limpiando...`);
        localStorage.removeItem(cacheKey);
      }
    } catch {
      console.warn(`Error al parsear cache para ${cacheKey}, limpiando...`);
      localStorage.removeItem(cacheKey);
    }
  }

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

  const res = await fetch(
    `https://app.jteanalytics.cl/auquinco/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  const rawData = await res.json();

  // Validar que la respuesta de la API sea un array
  const newData: Metric[] = Array.isArray(rawData) ? rawData : [];
  if (!Array.isArray(rawData)) {
    console.warn(`Respuesta inesperada del endpoint ${endpoint}:`, rawData);
  }

  const newDates = new Set(newData.map((d) => d.time.split("T")[0]));
  data = data.filter((d) => !newDates.has(d.time.split("T")[0]));
  const merged = [...data, ...newData];

  const toCache = merged.filter((d) => d.time.split("T")[0] !== endStr);
  localStorage.setItem(cacheKey, JSON.stringify(toCache));

  return merged;
};

export const fetchWithCacheMulti = async <T extends Record<string, Metric[]>>(
  endpoint: string,
  endStr: string,
): Promise<T> => {
  const cacheKey = `jte_cache_auquinco${endpoint}`;
  const cached = localStorage.getItem(cacheKey);
  const data: Record<string, Metric[]> = cached ? JSON.parse(cached) : {};

  // Find startStr
  let startStr = "";
  const keys = Object.keys(data);
  if (keys.length > 0 && data[keys[0]] && data[keys[0]].length > 0) {
    startStr = data[keys[0]][data[keys[0]].length - 1].time.split("T")[0];
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    startStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
    }).format(d);
  }

  const res = await fetch(
    `https://app.jteanalytics.cl/auquinco/${endpoint}?start=${startStr}&end=${endStr}`,
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
    merged[k] = mergedArray;

    const toCacheArray = mergedArray.filter(
      (d) => d.time.split("T")[0] !== endStr,
    );
    toCache[k] = toCacheArray;
  });

  localStorage.setItem(cacheKey, JSON.stringify(toCache));

  return merged as T;
};

// Limpiar toda la caché de auquinco del localStorage
export const clearAuquincoCache = () => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("jte_cache_auquinco")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  return keysToRemove.length;
};

// Ctrl+Shift+F5 → limpiar caché y recargar
window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.key === "F5") {
    e.preventDefault();
    const removed = clearAuquincoCache();
    console.log(`Caché limpiada: ${removed} entrada(s) eliminada(s).`);
    window.location.reload();
  }
});
