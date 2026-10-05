interface Metric {
  value: number;
  time: string;
}

// ── Deduplicación de requests en vuelo ───────────────────────────────
// Si ya hay un fetch pendiente para el mismo endpoint, devuelve la misma Promise
const inFlightRequests = new Map<string, Promise<unknown>>();

function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, promise);
  return promise;
}

// Fetch con Caché
export const fetchWithCache = async (
  endpoint: string,
  endStr: string,
): Promise<Metric[]> => {
  return dedupeRequest(`single_${endpoint}_${endStr}`, async () => {
    const cacheKey = `jte_cache_bucalemu${endpoint}`;
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

    const res = await fetch(
      `https://app.jteanalytics.cl/bucalemu/metrics/${endpoint}?start=${startStr}&end=${endStr}`,
    );
    const newData: Metric[] = await res.json();

    const newDates = new Set(newData.map((d) => d.time.split("T")[0]));
    data = data.filter((d) => !newDates.has(d.time.split("T")[0]));
    const merged = [...data, ...newData];

    const toCache = merged.filter((d) => d.time.split("T")[0] !== endStr);
    localStorage.setItem(cacheKey, JSON.stringify(toCache));

    return merged;
  });
};

export const fetchWithCacheMulti = async <T extends Record<string, Metric[]>>(
  endpoint: string,
  endStr: string,
): Promise<T> => {
  return dedupeRequest(`multi_${endpoint}_${endStr}`, async () => {
    const cacheKey = `jte_cache_bucalemu${endpoint}`;
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
      `https://app.jteanalytics.cl/bucalemu/metrics/${endpoint}?start=${startStr}&end=${endStr}`,
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
  });
};
