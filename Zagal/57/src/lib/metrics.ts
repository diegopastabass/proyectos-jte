// Métricas derivadas del resumen diario. Funciones puras: reciben filas ya
// cargadas y devuelven números listos para mostrar.
import { TOTALIZADOR_FACTOR } from "../config";
import { daysInMonth, diffDays, monthStart } from "./dates";
import type { SummaryRow } from "./summaryCache";

export const ALL_SECTORS = "__ALL__";

export interface PeriodTotals {
  seconds: number;
  /** m³ */
  volume: number;
  /** Días con al menos 1 min de riego */
  irrigationDays: number;
  /** Caudal promedio ponderado por tiempo de riego (l/s), null sin datos */
  avgCaudal: number | null;
  /** Hubo riego pero el totalizador no registró volumen */
  volumeMissing: boolean;
}

export interface DayPoint {
  date: string;
  seconds: number;
  volume: number;
  avgCaudal: number | null;
}

export interface SectorSummary extends PeriodTotals {
  id: string;
  /** Participación en el volumen (o en el tiempo si no hay volumen) del periodo */
  share: number;
  prevAvgCaudal: number | null;
  /** Variación del caudal promedio vs. periodo anterior (0.1 = +10%) */
  caudalDelta: number | null;
}

const MIN_DAY_SECONDS = 60;

export const volumeOf = (r: SummaryRow) => r.totalizador * TOTALIZADOR_FACTOR;

const inScope = (r: SummaryRow, sector: string) =>
  sector === ALL_SECTORS || r.mt_name === sector;

export function filterRows(rows: SummaryRow[], sector: string, from: string, to: string) {
  return rows.filter((r) => r.date >= from && r.date <= to && inScope(r, sector));
}

export function totals(rows: SummaryRow[]): PeriodTotals {
  let seconds = 0;
  let volume = 0;
  let caudalWeighted = 0;
  let caudalSeconds = 0;
  const perDay = new Map<string, number>();

  for (const r of rows) {
    seconds += r.value;
    volume += volumeOf(r);
    if (r.caudal > 0 && r.value > 0) {
      caudalWeighted += r.caudal * r.value;
      caudalSeconds += r.value;
    }
    perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.value);
  }

  const irrigationDays = [...perDay.values()].filter((s) => s >= MIN_DAY_SECONDS).length;
  return {
    seconds,
    volume,
    irrigationDays,
    avgCaudal: caudalSeconds > 0 ? caudalWeighted / caudalSeconds : null,
    volumeMissing: seconds >= MIN_DAY_SECONDS && volume <= 0,
  };
}

/** Un punto por día del mes hasta `lastDay` (inclusive), con ceros donde no hubo riego */
export function dailySeries(rows: SummaryRow[], month: string, lastDay: string): DayPoint[] {
  const byDay = new Map<string, SummaryRow[]>();
  rows.forEach((r) => byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]));

  const points: DayPoint[] = [];
  const n = daysInMonth(month);
  for (let d = 1; d <= n; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    if (date > lastDay) break;
    const t = totals(byDay.get(date) ?? []);
    points.push({ date, seconds: t.seconds, volume: t.volume, avgCaudal: t.avgCaudal });
  }
  return points;
}

export function sectorSummaries(
  sectorIds: string[],
  rows: SummaryRow[],
  prevRows: SummaryRow[],
): SectorSummary[] {
  const base = sectorIds.map((id) => {
    const cur = totals(rows.filter((r) => r.mt_name === id));
    const prev = totals(prevRows.filter((r) => r.mt_name === id));
    // Solo se compara el caudal si en ambos periodos hubo al menos 1 h de riego
    const comparable =
      cur.avgCaudal !== null && prev.avgCaudal && cur.seconds >= 3600 && prev.seconds >= 3600;
    return {
      id,
      ...cur,
      prevAvgCaudal: prev.avgCaudal,
      caudalDelta: comparable ? cur.avgCaudal! / prev.avgCaudal! - 1 : null,
      share: 0,
    };
  });

  const totalVolume = base.reduce((s, x) => s + x.volume, 0);
  const totalSeconds = base.reduce((s, x) => s + x.seconds, 0);
  return base.map((x) => ({
    ...x,
    share:
      totalVolume > 0
        ? x.volume / totalVolume
        : totalSeconds > 0
          ? x.seconds / totalSeconds
          : 0,
  }));
}

/** Último día con riego por sector (YYYY-MM-DD), buscando en todas las filas dadas */
export function lastIrrigationBySector(rows: SummaryRow[]): Record<string, string> {
  const last: Record<string, string> = {};
  for (const r of rows) {
    if (r.value < MIN_DAY_SECONDS) continue;
    if (!last[r.mt_name] || r.date > last[r.mt_name]) last[r.mt_name] = r.date;
  }
  return last;
}

// Un sector se considera "rezagado" si lleva STALE_DAYS sin riego mientras otros
// sectores sí regaron hace poco (así no se alerta en invierno, cuando no riega nadie).
export const STALE_DAYS = 7;
const RECENT_DAYS = 2;

export function staleSectors(
  sectorIds: string[],
  last: Record<string, string>,
  today: string,
): Set<string> {
  const someoneRecent = sectorIds.some(
    (id) => last[id] && diffDays(last[id], today) <= RECENT_DAYS,
  );
  if (!someoneRecent) return new Set();
  return new Set(
    sectorIds.filter((id) => !last[id] || diffDays(last[id], today) >= STALE_DAYS),
  );
}

/**
 * Periodo con el que comparar un mes. Para el mes en curso se compara contra
 * los mismos días del mes anterior (1..hoy), para que la comparación sea justa.
 */
export function comparisonRange(
  month: string,
  prevMonth: string,
  lastDayOfPeriod: string,
): { from: string; to: string } {
  const dayNum = Number(lastDayOfPeriod.slice(8, 10));
  const prevDays = daysInMonth(prevMonth);
  const isPartial = dayNum < daysInMonth(month);
  const toDay = isPartial ? Math.min(dayNum, prevDays) : prevDays;
  return {
    from: monthStart(prevMonth),
    to: `${prevMonth}-${String(toDay).padStart(2, "0")}`,
  };
}

/** (actual - anterior) / anterior; null si no hay base de comparación */
export const ratioDelta = (current: number, previous: number): number | null =>
  previous > 0 ? current / previous - 1 : null;
