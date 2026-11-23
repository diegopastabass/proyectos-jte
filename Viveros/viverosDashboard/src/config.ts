/** URL base de la API. `VITE_API_BASE` permite probar contra una API local. */
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? "https://app.jteanalytics.cl/viveros";

export type ZonaId = "frio" | "calor" | "exterior";
export type Variable = "t" | "hr" | "vpd";

export const ORDEN_ZONAS: ZonaId[] = ["frio", "calor", "exterior"];
export const ZONAS_CONTROLADAS: ZonaId[] = ["frio", "calor"];

/** Color de cada zona: solo para líneas y encabezados, nunca para estado. */
export const COLOR_ZONA: Record<ZonaId, string> = {
  frio: "#2f6fdf",
  calor: "#e8710a",
  exterior: "#6b8f71",
};

export const NOMBRE_VARIABLE: Record<Variable, string> = {
  t: "Temperatura",
  hr: "Humedad",
  vpd: "VPD",
};

export const UNIDAD: Record<Variable, string> = { t: "°C", hr: "%", vpd: "kPa" };
export const DECIMALES: Record<Variable, number> = { t: 1, hr: 1, vpd: 2 };

/** Igual que la API (`viveros.config.ts`): huecos mayores a esto se dibujan como corte. */
export const TOPE_MIN: Record<ZonaId, number> = { frio: 20, calor: 20, exterior: 15 };

/** Refresco del estado y de las series (se pausa con la pestaña oculta). */
export const REFRESCO_ESTADO_MS = 2 * 60_000;
export const REFRESCO_SERIES_MS = 5 * 60_000;
