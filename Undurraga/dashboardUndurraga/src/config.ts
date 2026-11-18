/** Se puede apuntar a otra API en desarrollo con VITE_API_BASE. */
export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "https://app.jteanalytics.cl/undurraga";

/** Los datos llegan cada minuto; el detalle se ve en el gráfico del día. */
export const REFRESCO_MS = 5 * 60_000;

export const DIAS_DIARIO = 15;
export const MESES_RESUMEN = 12;

/** Antigüedad del último dato (min): verde hasta MIN_VERDE, amarillo hasta MIN_SIN_DATOS, rojo después. */
export const MIN_VERDE = 15;
export const MIN_SIN_DATOS = 30;

export type LineaId = "equipo1" | "equipo2" | "piscina";

export interface Linea {
  id: LineaId;
  nombre: string;
  /** Id del sensor de caudal en la API; la piscina no tiene. */
  caudal?: string;
  totalizador: string;
  color: string;
  relleno: string;
}

// Nombres provisorios: reemplazar por los reales cuando el cliente los confirme.
export const LINEAS: Record<LineaId, Linea> = {
  equipo1: {
    id: "equipo1",
    nombre: "Equipo 1",
    caudal: "1",
    totalizador: "4",
    color: "rgb(5, 130, 202)",
    relleno: "rgba(5, 130, 202, 0.15)",
  },
  equipo2: {
    id: "equipo2",
    nombre: "Equipo 2",
    caudal: "2",
    totalizador: "3",
    color: "rgb(214, 128, 0)",
    relleno: "rgba(214, 128, 0, 0.15)",
  },
  piscina: {
    id: "piscina",
    nombre: "Piscina",
    totalizador: "5",
    color: "rgb(46, 139, 87)",
    relleno: "rgba(46, 139, 87, 0.15)",
  },
};

export const ORDEN_LINEAS: LineaId[] = ["equipo1", "equipo2", "piscina"];

/** Líneas con sensor de caudal (gráfico del día y consumo por hora). */
export const LINEAS_CAUDAL: LineaId[] = ORDEN_LINEAS.filter(
  (id) => LINEAS[id].caudal,
);
