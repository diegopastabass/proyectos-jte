import type { EstadoValor, EstadoZona, Frescura, MinutosEstado } from "./tipos";

/** Colores de estado: el único significado del verde, ámbar, rojo y gris en la app. */
export const COLOR_ESTADO = {
  ok: "#198754",
  cerca: "#c98a00",
  fuera: "#dc3545",
  sin_datos: "#8a8f94",
};

/** Para valores sin estado (exterior, variables sin rango). */
export const COLOR_NEUTRO = "#5c6670";

export const FONDO_ESTADO = {
  ok: "#d1e7dd",
  cerca: "#fff3cd",
  fuera: "#f8d7da",
  sin_datos: "#e9ecef",
};

type Tono = keyof typeof COLOR_ESTADO;

export const tonoValor = (e: EstadoValor): Tono | "neutro" => {
  if (e === "ok") return "ok";
  if (e === "cerca") return "cerca";
  if (e === "bajo" || e === "alto") return "fuera";
  if (e === "sin_dato") return "sin_datos";
  return "neutro";
};

export const tonoZona = (e: EstadoZona): Tono | "neutro" =>
  e === "informativo" ? "neutro" : e;

export const TEXTO_VALOR: Record<EstadoValor, string> = {
  ok: "En rango",
  cerca: "Cerca del límite",
  bajo: "Bajo el mínimo",
  alto: "Sobre el máximo",
  sin_rango: "Sin rango definido",
  sin_dato: "Sin dato",
};

export const TEXTO_ZONA: Record<EstadoZona, string> = {
  ok: "En rango",
  cerca: "Cerca del límite",
  fuera: "Fuera de rango",
  sin_datos: "Sin datos",
  informativo: "Referencia",
};

export const ICONO_ZONA: Record<EstadoZona, string> = {
  ok: "bi-check-circle-fill",
  cerca: "bi-exclamation-circle-fill",
  fuera: "bi-x-octagon-fill",
  sin_datos: "bi-wifi-off",
  informativo: "bi-cloud-sun",
};

export const COLOR_FRESCURA: Record<Frescura, string> = {
  al_dia: COLOR_ESTADO.ok,
  retrasado: COLOR_ESTADO.cerca,
  sin_datos: COLOR_ESTADO.fuera,
};

/** % del tiempo con datos que estuvo en rango (incluye "cerca del límite"). */
export const porcentajeEnRango = (m: MinutosEstado): number | null => {
  const conDatos = m.ok + m.cerca + m.fuera;
  return conDatos > 0 ? ((m.ok + m.cerca) / conDatos) * 100 : null;
};

/** Mismo criterio que el informe PDF: ≥ 95 % verde, ≥ 80 % ámbar, menos rojo. */
export const tonoCumplimiento = (m: MinutosEstado): Tono => {
  const total = m.ok + m.cerca + m.fuera + m.sin_datos;
  const pct = porcentajeEnRango(m);
  if (pct === null || m.sin_datos > total * 0.5) return "sin_datos";
  if (pct >= 95) return "ok";
  if (pct >= 80) return "cerca";
  return "fuera";
};

/** Misma regla que la API (`lib/analisis.ts`). */
export function clasificar(
  valor: number | null,
  min: number | null,
  max: number | null,
  margen: number,
): EstadoValor {
  if (valor === null) return "sin_dato";
  if (min === null && max === null) return "sin_rango";
  if (min !== null && valor < min) return "bajo";
  if (max !== null && valor > max) return "alto";
  if ((min !== null && valor < min + margen) || (max !== null && valor > max - margen)) return "cerca";
  return "ok";
}
