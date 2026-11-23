import { API_BASE, type ZonaId } from "../config";
import type { Config, Episodio, Estado, PuntoSerie, ResumenZona } from "./tipos";

export async function getJson<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/${ruta}`, init);
  if (!res.ok) {
    let detalle = "";
    try {
      const cuerpo = await res.json();
      const m = cuerpo?.error?.message ?? cuerpo?.message;
      detalle = Array.isArray(m) ? m.join(", ") : (m ?? "");
    } catch {
      /* respuesta sin JSON */
    }
    throw Object.assign(new Error(detalle || `Error ${res.status} al consultar ${ruta}`), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

const rango = (start: string, end: string) => `start=${start}&end=${end}`;

export const getConfig = () => getJson<Config>("config");
export const getEstado = () => getJson<Estado>("estado");

export const getSerieHoras = (zona: ZonaId, horas: number) =>
  getJson<PuntoSerie[]>(`serie?zona=${zona}&horas=${horas}`);

export const getSerie = (zona: ZonaId, start: string, end: string) =>
  getJson<PuntoSerie[]>(`serie?zona=${zona}&${rango(start, end)}`);

export const getResumen = (start: string, end: string) =>
  getJson<{ zonas: ResumenZona[] }>(`resumen-diario?${rango(start, end)}`).then((r) => r.zonas);

export const getHorario = (zona: ZonaId, start: string, end: string) =>
  getJson<PuntoSerie[]>(`horario?zona=${zona}&${rango(start, end)}`);

export const getEpisodios = (start: string, end: string) =>
  getJson<Episodio[]>(`episodios?${rango(start, end)}`);

export const conToken = (token: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    ...(init.headers ?? {}),
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
