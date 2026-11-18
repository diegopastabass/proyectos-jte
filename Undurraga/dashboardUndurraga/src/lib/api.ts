import { API_BASE } from "../config";
import { diaChile, hoyChile, sumarDias } from "./fechas";
import type { Latest, Punto } from "../components/types";

export async function getJson<T>(ruta: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${ruta}`);
  if (!res.ok) throw new Error(`Error ${res.status} al consultar ${ruta}`);
  return res.json() as Promise<T>;
}

/** La API puede devolver los valores como texto; aquí siempre quedan como número. */
export async function getSerie(ruta: string): Promise<Punto[]> {
  const datos = await getJson<{ value: number | string; time: string }[]>(ruta);
  return datos.map((d) => ({ time: d.time, value: Number(d.value) }));
}

/** Día AAAA-MM-DD de un punto diario (versiones anteriores de la API lo devolvían como ISO). */
export const aDia = (time: string): string =>
  time.includes("T") ? diaChile(time) : time.slice(0, 10);

export async function getDiario(sensor: string, start: string, end: string) {
  const datos = await getSerie(conRango(`totalizador/${sensor}`, start, end));
  return datos.map((d) => ({ ...d, time: aDia(d.time) }));
}

export const conRango = (ruta: string, start: string, end: string) =>
  `${ruta}?start=${start}&end=${end}`;

export const getLatest = () => getJson<Latest>("latest");

// --- Caché local del consumo diario ---------------------------------------
// Solo guarda días cerrados (el de hoy siempre se pide) y solo los últimos `dias`.

const PREFIJO_CACHE = "jte_cache_v2_undurraga_diario_";

const leerCache = (clave: string): Punto[] => {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as Punto[]) : [];
  } catch {
    return [];
  }
};

const guardarCache = (clave: string, datos: Punto[]) => {
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento disponible: se sigue sin caché.
  }
};

/** Consumo diario (m³) de los últimos `dias` días, incluido hoy. */
export async function getDiarioConCache(
  sensor: string,
  dias: number,
): Promise<Punto[]> {
  const hoy = hoyChile();
  const desde = sumarDias(hoy, -(dias - 1));
  const clave = PREFIJO_CACHE + sensor;

  const cacheados = leerCache(clave).filter(
    (d) => d.time >= desde && d.time < hoy,
  );
  const ultimo = cacheados.at(-1)?.time;
  const start = ultimo ? sumarDias(ultimo, 1) : desde;

  const nuevos = (await getDiario(sensor, start, hoy)).filter(
    (d) => d.time >= start,
  );
  const todos = [...cacheados, ...nuevos];

  guardarCache(
    clave,
    todos.filter((d) => d.time < hoy),
  );
  return todos;
}
