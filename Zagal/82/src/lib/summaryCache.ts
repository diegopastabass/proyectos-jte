// Caché del resumen diario (/summary) en localStorage, un registro por mes.
//
// Un día queda "cerrado" cuando ya pasaron 2 días: hoy cambia en vivo y ayer
// todavía puede cambiar (riegos que cruzan la medianoche se atribuyen al día en
// que empezaron). Los días cerrados se guardan y no se vuelven a pedir, así:
//   - un mes pasado se descarga una sola vez;
//   - en el mes en curso cada actualización pide solo ayer y hoy.
import { API_BASE, MIN_MONTH } from "../config";
import {
  addDays,
  maxDate,
  minDate,
  monthEnd,
  monthOf,
  monthStart,
  todayChile,
} from "./dates";
import { fetchJson } from "./http";
import { listKeys, readJson, removeKey, writeJson } from "./storage";

export interface SummaryRow {
  mt_name: string;
  /** YYYY-MM-DD */
  date: string;
  /** segundos de riego */
  value: number;
  /** totalizador crudo (multiplicar por TOTALIZADOR_FACTOR para m³) */
  totalizador: number;
  /** caudal promedio durante el riego, l/s */
  caudal: number;
}

interface MonthEntry {
  rows: SummaryRow[];
  /** Último día (inclusive) cuyos datos ya son definitivos */
  stableUntil: string | null;
}

// Subir la versión invalida todo lo guardado (p. ej. si cambia el cálculo del backend)
const CACHE_VERSION = "v1";
const KEY_PREFIX = `summary_${CACHE_VERSION}_`;
const MAX_MONTHS_STORED = 36;

const keyFor = (month: string) => `${KEY_PREFIX}${month}`;

// El backend devuelve la fecha como timestamp ("2026-09-01T04:00:00.000Z"):
// los primeros 10 caracteres son el día, igual que el getUTCDate() que se usaba antes.
const normalize = (rows: SummaryRow[]): SummaryRow[] =>
  rows.map((r) => ({
    mt_name: r.mt_name,
    date: String(r.date).slice(0, 10),
    value: Number(r.value) || 0,
    totalizador: Number(r.totalizador) || 0,
    caudal: Number(r.caudal) || 0,
  }));

function pruneOldMonths(keep = MAX_MONTHS_STORED / 2) {
  // Borra versiones antiguas y los meses más viejos
  const all = listKeys("summary_");
  all.filter((k) => !k.startsWith(KEY_PREFIX)).forEach(removeKey);
  const current = all.filter((k) => k.startsWith(KEY_PREFIX)).sort();
  current.slice(0, Math.max(0, current.length - keep)).forEach(removeKey);
}

function save(month: string, entry: MonthEntry) {
  writeJson(keyFor(month), entry, () => pruneOldMonths());
  if (listKeys(KEY_PREFIX).length > MAX_MONTHS_STORED) pruneOldMonths(MAX_MONTHS_STORED);
}

/** El mes todavía puede cambiar (incluye ayer u hoy) */
export const isOpenMonth = (month: string): boolean =>
  monthEnd(month) >= addDays(todayChile(), -1);

// Una sola petición por mes aunque varios componentes lo pidan a la vez. La
// petición compartida se cancela solo cuando todos los que la esperan se fueron.
interface Flight {
  promise: Promise<SummaryRow[]>;
  controller: AbortController;
  waiting: number;
}
const inFlight = new Map<string, Flight>();

export function loadMonth(month: string, signal?: AbortSignal): Promise<SummaryRow[]> {
  let flight = inFlight.get(month);
  if (!flight) {
    const controller = new AbortController();
    const promise = loadMonthUncached(month, controller.signal).finally(() => {
      if (inFlight.get(month)?.promise === promise) inFlight.delete(month);
    });
    flight = { promise, controller, waiting: 0 };
    inFlight.set(month, flight);
  }
  if (!signal) return flight.promise;

  const f = flight;
  f.waiting++;
  return new Promise<SummaryRow[]>((resolve, reject) => {
    const onAbort = () => {
      f.waiting--;
      if (f.waiting === 0) {
        inFlight.delete(month);
        f.controller.abort();
      }
      reject(new DOMException("Cancelado", "AbortError"));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    f.promise.then(
      (rows) => {
        signal.removeEventListener("abort", onAbort);
        f.waiting--;
        resolve(rows);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        f.waiting--;
        reject(error);
      },
    );
  });
}

async function loadMonthUncached(month: string, signal?: AbortSignal): Promise<SummaryRow[]> {
  const today = todayChile();
  if (month < MIN_MONTH || month > monthOf(today)) return [];

  const start = monthStart(month);
  const end = minDate(monthEnd(month), today);
  const cached = readJson<MonthEntry>(keyFor(month));

  if (cached?.stableUntil && cached.stableUntil >= end) return cached.rows;

  const from = cached?.stableUntil ? addDays(cached.stableUntil, 1) : start;
  const fresh = normalize(
    await fetchJson<SummaryRow[]>(
      `${API_BASE}/summary?startDate=${from}&endDate=${end}`,
      signal,
    ),
  );

  const rows = [...(cached?.rows ?? []).filter((r) => r.date < from), ...fresh];
  const lastFinal = minDate(end, addDays(today, -2));
  save(month, { rows, stableUntil: lastFinal >= start ? lastFinal : null });
  return rows;
}

/** Todos los meses entre from y to (YYYY-MM), usando la caché */
export async function loadMonthRange(
  fromMonth: string,
  toMonth: string,
  signal?: AbortSignal,
): Promise<SummaryRow[]> {
  const months: string[] = [];
  for (let m = maxDate(fromMonth, MIN_MONTH); m <= toMonth; ) {
    months.push(m);
    const [y, mm] = m.split("-").map(Number);
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
  }
  // De a uno: los meses no cacheados son consultas pesadas, no saturar el backend
  const result: SummaryRow[] = [];
  for (const m of months) result.push(...(await loadMonth(m, signal)));
  return result;
}
