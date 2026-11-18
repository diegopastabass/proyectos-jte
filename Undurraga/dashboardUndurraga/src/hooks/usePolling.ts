import { useEffect, useRef } from "react";

/**
 * Ejecuta `fn` al montar y cada vez que cambia `clave`; luego cada `ms` mientras la
 * pestaña esté visible (al volver a ella, actualiza de inmediato). Con `ms` null solo
 * ejecuta una vez por `clave`.
 */
export function usePolling(fn: () => void, ms: number | null, clave = "") {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });

  useEffect(() => {
    ref.current();
    if (ms === null) return;

    let id: number | undefined;
    const iniciar = () => {
      id = window.setInterval(() => ref.current(), ms);
    };
    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        window.clearInterval(id);
        id = undefined;
      } else if (id === undefined) {
        ref.current();
        iniciar();
      }
    };

    iniciar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [ms, clave]);
}
