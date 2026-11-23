import type { Variable, ZonaId } from "../config";

export type EstadoValor = "ok" | "cerca" | "bajo" | "alto" | "sin_rango" | "sin_dato";
export type EstadoZona = "ok" | "cerca" | "fuera" | "sin_datos" | "informativo";
export type Frescura = "al_dia" | "retrasado" | "sin_datos";

export interface RangoVariable {
  min: number | null;
  max: number | null;
  alerta: boolean;
  unidad: string;
  margen: number;
}

export interface ZonaConfig {
  id: ZonaId;
  nombre: string;
  controlada: boolean;
  origen: string;
  variables: Record<Variable, RangoVariable>;
}

export interface Config {
  zonas: ZonaConfig[];
  frescura: { retrasoMin: number; sinDatosMin: number };
}

export interface Estadistica {
  min: number;
  max: number;
  prom: number;
}

export interface MinutosEstado {
  ok: number;
  cerca: number;
  fuera: number;
  sin_datos: number;
}

export interface ResumenDia {
  dia: string;
  minutos: MinutosEstado;
  t: Estadistica | null;
  hr: Estadistica | null;
  vpd: Estadistica | null;
  fueraMin: { t: number; hr: number };
}

export interface ValorActual {
  valor: number | null;
  estado: EstadoValor;
  pegadoDesde?: string | null;
}

export interface EstadoZonaApi {
  id: ZonaId;
  nombre: string;
  controlada: boolean;
  origen: string;
  ultimo: string | null;
  frescura: Frescura;
  estado: EstadoZona;
  fueraDesde: string | null;
  t: ValorActual;
  hr: ValorActual;
  vpd: ValorActual;
  hoy: ResumenDia;
  equipo: { valor: number; time: string } | null;
}

export interface Estado {
  generado: string;
  zonas: EstadoZonaApi[];
}

export interface PuntoSerie {
  time: string;
  t: number | null;
  hr: number | null;
  vpd: number | null;
}

export interface ResumenZona {
  id: ZonaId;
  nombre: string;
  controlada: boolean;
  dias: ResumenDia[];
}

export interface Episodio {
  zona: ZonaId;
  zonaNombre: string;
  variable: "t" | "hr";
  tipo: "bajo" | "alto";
  inicio: string;
  fin: string;
  duracionMin: number;
  extremo: number;
  limite: number | null;
  enCurso: boolean;
}
