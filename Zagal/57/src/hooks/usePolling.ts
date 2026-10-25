import { useEffect, useRef } from "react";
import { isAbortError } from "../lib/http";

/**
 * Ejecuta `task` al montar y luego cada `intervalMs`, con tres reglas:
 *  - no consulta mientras la pestaña está oculta (y al volver, refresca si toca);
 *  - nunca lanza una consulta si la anterior sigue en curso;
 *  - al desmontar o cambiar `deps`, cancela la consulta en curso.
 * Con `repeat = false` solo corre una vez por cada cambio de `deps`.
 */
export function usePolling(
  task: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  deps: unknown[],
  repeat = true,
) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    let lastRun = 0;

    const run = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      lastRun = Date.now();
      try {
        await taskRef.current(controller.signal);
      } catch (error) {
        if (!isAbortError(error)) console.error(error);
      } finally {
        running = false;
      }
    };

    run();
    if (!repeat) return () => controller.abort();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun >= intervalMs) {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, repeat, ...deps]);
}
