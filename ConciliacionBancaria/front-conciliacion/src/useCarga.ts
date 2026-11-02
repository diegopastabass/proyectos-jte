import { useCallback, useEffect, useState } from "react";
import api, { mensajeError } from "./api";

type Params = Record<string, string | number | boolean | undefined | null>;

interface Estado<T> {
  clave: string;
  datos?: T;
  error?: string;
}

/**
 * GET con estado de carga. Vuelve a pedir cuando cambian `url` o `params`, y con `recargar()`.
 * `url` null = no pedir nada todavía. Los params vacíos ("", null, undefined) no se envían.
 */
export function useCarga<T>(url: string | null, params?: Params) {
  const limpios = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== "" && v !== null && v !== undefined),
  );
  const clave = url === null ? "" : JSON.stringify([url, limpios]);
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState<Estado<T>>({ clave: "" });
  const claveVersion = `${clave}#${version}`;

  useEffect(() => {
    if (!clave) return;
    const [u, p] = JSON.parse(clave) as [string, Params];
    let vigente = true;
    api
      .get<T>(u, { params: p })
      .then((r) => vigente && setEstado({ clave: claveVersion, datos: r.data }))
      .catch((e: unknown) => vigente && setEstado({ clave: claveVersion, error: mensajeError(e) }));
    return () => {
      vigente = false;
    };
  }, [clave, claveVersion]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const listo = estado.clave === claveVersion;

  return {
    // Mientras recarga se siguen mostrando los datos anteriores (evita parpadeos en tablas).
    datos: estado.datos,
    error: listo ? estado.error : undefined,
    cargando: clave !== "" && !listo,
    recargar,
  };
}
