interface Metric {
  value: number;
  time: string;
}
// Fetch con Caché
export const fetchWithCache = async (
  endpoint: string,
  endStr: string,
): Promise<Metric[]> => {
  const cacheKey = `jte_cache_${endpoint}`;
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
    `https://app.jteanalytics.cl/auquinco/${endpoint}?start=${startStr}&end=${endStr}`,
  );
  const newData: Metric[] = await res.json();

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
  const cacheKey = `jte_cache_${endpoint}`;
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

