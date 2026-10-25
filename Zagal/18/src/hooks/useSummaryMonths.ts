import { useState } from "react";
import { isAbortError } from "../lib/http";
import { isOpenMonth, loadMonth, type SummaryRow } from "../lib/summaryCache";
import { LIVE_REFRESH_MS } from "./useLiveData";
import { usePolling } from "./usePolling";

export type MonthData = Record<string, SummaryRow[]>;

/**
 * Carga el resumen de varios meses (YYYY-MM) desde la caché. Solo vuelve a
 * consultar periódicamente si alguno de los meses sigue abierto, y en ese caso
 * la caché pide únicamente ayer y hoy.
 */
export function useSummaryMonths(months: string[]) {
  const [data, setData] = useState<MonthData>({});
  const [error, setError] = useState<string | null>(null);
  const key = [...new Set(months)].sort().join(",");
  const unique = key ? key.split(",") : [];
  const anyOpen = unique.some(isOpenMonth);

  usePolling(
    async (signal) => {
      const results = await Promise.allSettled(unique.map((m) => loadMonth(m, signal)));
      if (signal.aborted) return;
      const loaded: MonthData = {};
      let failed = false;
      results.forEach((r, i) => {
        if (r.status === "fulfilled") loaded[unique[i]] = r.value;
        else if (!isAbortError(r.reason)) failed = true;
      });
      // Se conserva lo anterior: si un mes falla, se sigue mostrando lo último que hubo
      setData((prev) => ({ ...prev, ...loaded }));
      setError(failed ? "No se pudo cargar parte del historial de riego" : null);
    },
    LIVE_REFRESH_MS,
    [key],
    anyOpen,
  );

  const loading = unique.some((m) => !(m in data)) && !error;
  return { data, loading, error };
}
