/** Se puede apuntar a otra API en desarrollo con VITE_API_BASE. */
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "https://app.jteanalytics.cl/montes";

/** Los datos llegan cada 10 min; consultar más seguido no trae nada nuevo. */
export const REFRESCO_MS = 5 * 60_000;

export const DIAS_DIARIO = 15;
export const MESES_RESUMEN = 12;

/** Antigüedad del último dato (min): verde hasta MIN_VERDE, amarillo hasta MIN_SIN_DATOS, rojo después. */
export const MIN_VERDE = 15;
export const MIN_SIN_DATOS = 30;

export type LineaId = "general" | "riles";

export interface Linea {
  id: LineaId;
  nombre: string;
  caudal: string;
  totalizador: string;
  color: string;
  relleno: string;
}

export const LINEAS: Record<LineaId, Linea> = {
  general: {
    id: "general",
    nombre: "General",
    caudal: "montes_general_caudal",
    totalizador: "montes_general_totalizador",
    color: "rgb(5, 130, 202)",
    relleno: "rgba(5, 130, 202, 0.15)",
  },
  riles: {
    id: "riles",
    nombre: "Riles",
    caudal: "montes_riles_caudal",
    totalizador: "montes_riles_totalizador",
    color: "rgb(214, 128, 0)",
    relleno: "rgba(214, 128, 0, 0.15)",
  },
};

export const ORDEN_LINEAS: LineaId[] = ["general", "riles"];
