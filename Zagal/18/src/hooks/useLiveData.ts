import { useState } from "react";
import { API_BASE } from "../config";
import { fetchJson } from "../lib/http";
import { readJson, writeJson } from "../lib/storage";
import { usePolling } from "./usePolling";

export interface IrrigationInterval {
  mt_name: string;
  is_active: number;
  tiempo_riego_segundos: number;
  /** crudo: multiplicar por TOTALIZADOR_FACTOR */
  totalizador: number;
}

export interface LiveMetric {
  caudal: number;
  /** m³ (el backend ya lo escala) */
  totalizador: number;
}

export interface LiveData {
  metric: LiveMetric | null;
  intervals: IrrigationInterval[];
  lastUpdate: string | null;
  /** Momento en que se obtuvieron estos datos (ms) */
  fetchedAt: number;
}

export const LIVE_REFRESH_MS = 120_000;
const CACHE_KEY = "live_v1";

/**
 * Datos en vivo (/metrics, /interval, /update). Al abrir el dashboard se
 * muestra al instante lo último guardado y luego se refresca.
 */
export function useLiveData() {
  const [data, setData] = useState<LiveData | null>(() => readJson<LiveData>(CACHE_KEY));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  usePolling(
    async (signal) => {
      setRefreshing(true);
      try {
        const [metric, intervals, lastUpdate] = await Promise.all([
          fetchJson<LiveMetric>(`${API_BASE}/metrics`, signal),
          fetchJson<IrrigationInterval[]>(`${API_BASE}/interval`, signal),
          fetchJson<string | null>(`${API_BASE}/update`, signal),
        ]);
        const next: LiveData = {
          metric,
          intervals: Array.isArray(intervals) ? intervals : [],
          lastUpdate,
          fetchedAt: Date.now(),
        };
        setData(next);
        setError(null);
        writeJson(CACHE_KEY, next);
      } catch (e) {
        if (!signal.aborted) setError("No se pudo actualizar la información en vivo");
        throw e;
      } finally {
        if (!signal.aborted) setRefreshing(false);
      }
    },
    LIVE_REFRESH_MS,
    [],
  );

  return { data, error, refreshing };
}
