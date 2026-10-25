import type { Metric, RawSeries } from "../types";
import { CHART_DAYS } from "../components/fetchWithcache";
import { shiftDay, utcDay } from "./time";

const BASE_URL = "https://app.jteanalytics.cl/ranguil";

// Las series crudas (5 min × 15 días ≈ 560 KB por endpoint) son demasiado
// pesadas para localStorage, por lo que se mantienen en memoria y los refrescos
// solo piden desde el último día recibido.
let store: RawSeries | null = null;

const mergeByTime = (old: Metric[], incoming: Metric[], cutoff: number) => {
  const map = new Map<string, Metric>();
  for (const m of old) map.set(m.time, m);
  for (const m of incoming) map.set(m.time, m);
  return [...map.values()]
    .filter((m) => new Date(m.time).getTime() >= cutoff)
    .sort((a, b) => a.time.localeCompare(b.time));
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${BASE_URL}/${path}`);
  if (!res.ok) throw new Error(`Error HTTP ${res.status} en ${path}`);
  return res.json();
};

const lastTime = (series: Metric[]): string | undefined =>
  series.length > 0 ? series[series.length - 1].time : undefined;

export const fetchRawSeries = async (): Promise<RawSeries> => {
  const now = Date.now();
  const cutoff = now - CHART_DAYS * 24 * 60 * 60 * 1000;
  const endStr = shiftDay(utcDay(now), 1);
  const defaultStart = utcDay(cutoff);

  const startFor = (series: Metric[] | undefined) => {
    const last = series && lastTime(series);
    return last ? utcDay(new Date(last).getTime()) : defaultStart;
  };
  const q = (start: string) => `?start=${start}&end=${endStr}`;

  const [voltaje, corriente, caudal, presion] = await Promise.all([
    fetchJson<RawSeries["voltaje"]>(
      `voltaje${q(startFor(store?.voltaje.v1))}`,
    ),
    fetchJson<RawSeries["corriente"]>(
      `corriente${q(startFor(store?.corriente.i1))}`,
    ),
    fetchJson<Metric[]>(`caudal${q(startFor(store?.caudal))}`),
    fetchJson<Metric[]>(`presion${q(startFor(store?.presion))}`),
  ]);

  store = {
    voltaje: {
      v1: mergeByTime(store?.voltaje.v1 ?? [], voltaje.v1, cutoff),
      v2: mergeByTime(store?.voltaje.v2 ?? [], voltaje.v2, cutoff),
      v3: mergeByTime(store?.voltaje.v3 ?? [], voltaje.v3, cutoff),
    },
    corriente: {
      i1: mergeByTime(store?.corriente.i1 ?? [], corriente.i1, cutoff),
      i2: mergeByTime(store?.corriente.i2 ?? [], corriente.i2, cutoff),
      i3: mergeByTime(store?.corriente.i3 ?? [], corriente.i3, cutoff),
    },
    caudal: mergeByTime(store?.caudal ?? [], caudal, cutoff),
    presion: mergeByTime(store?.presion ?? [], presion, cutoff),
  };
  return store;
};
