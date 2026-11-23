import { MARGENES, Umbral, Variable } from '../viveros.config';
import { inicioDiaChile, sumarDias } from './fechas';

/** Lectura emparejada de una zona: temperatura y humedad del mismo instante. */
export interface Lectura {
  ms: number;
  t: number | null;
  hr: number | null;
  vpd: number | null;
}

export type EstadoValor = 'ok' | 'cerca' | 'bajo' | 'alto' | 'sin_rango' | 'sin_dato';
export type EstadoZona = 'ok' | 'cerca' | 'fuera' | 'sin_datos';

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
  /** Minutos fuera de rango de cada variable. */
  fueraMin: { t: number; hr: number };
}

export interface Episodio {
  variable: 't' | 'hr';
  tipo: 'bajo' | 'alto';
  inicio: number;
  fin: number;
  extremo: number;
  enCurso: boolean;
}

export type UmbralesZona = Record<Variable, Umbral>;

/**
 * Déficit de presión de vapor (kPa), fórmula de Tetens:
 * SVP = 0,6108 · e^(17,27·T / (T + 237,3)); VPD = SVP · (1 − HR/100).
 */
export function calcularVpd(t: number | null, hr: number | null): number | null {
  if (t === null || hr === null) return null;
  const svp = 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
  return Math.round(svp * (1 - hr / 100) * 100) / 100;
}

export function clasificar(
  valor: number | null,
  umbral: Pick<Umbral, 'min' | 'max'>,
  margen: number,
): EstadoValor {
  if (valor === null) return 'sin_dato';
  const { min, max } = umbral;
  if (min === null && max === null) return 'sin_rango';
  if (min !== null && valor < min) return 'bajo';
  if (max !== null && valor > max) return 'alto';
  if ((min !== null && valor < min + margen) || (max !== null && valor > max - margen))
    return 'cerca';
  return 'ok';
}

const esFuera = (e: EstadoValor) => e === 'bajo' || e === 'alto';

/**
 * Estado de la zona en una lectura: el peor entre temperatura y humedad. El VPD
 * se informa aparte y no cuenta para el estado (depende de los otros dos).
 */
export function estadoLectura(l: Lectura, u: UmbralesZona): EstadoZona {
  const et = clasificar(l.t, u.t, MARGENES.t);
  const eh = clasificar(l.hr, u.hr, MARGENES.hr);
  if (et === 'sin_dato' && eh === 'sin_dato') return 'sin_datos';
  if (esFuera(et) || esFuera(eh)) return 'fuera';
  if (et === 'cerca' || eh === 'cerca') return 'cerca';
  return 'ok';
}

function estadistica(valores: (number | null)[]): Estadistica | null {
  const v = valores.filter((x): x is number => x !== null);
  if (!v.length) return null;
  let min = v[0];
  let max = v[0];
  let suma = 0;
  for (const x of v) {
    if (x < min) min = x;
    if (x > max) max = x;
    suma += x;
  }
  const r = (x: number) => Math.round(x * 100) / 100;
  return { min: r(min), max: r(max), prom: r(suma / v.length) };
}

/**
 * Resumen por día (hora Chile). Cada lectura vale hasta la siguiente, con tope de
 * `topeMin`; el tiempo no cubierto es "sin datos". El día en curso se cuenta solo
 * hasta `ahora`. Las lecturas deben venir ordenadas por hora.
 */
export function resumirDias(
  lecturas: Lectura[],
  dias: string[],
  u: UmbralesZona,
  topeMin: number,
  ahora = Date.now(),
): ResumenDia[] {
  const tope = topeMin * 60000;
  let k = 0;
  return dias.map((dia) => {
    const desde = inicioDiaChile(dia);
    const hasta = Math.min(inicioDiaChile(sumarDias(dia, 1)), ahora);
    const minutos: MinutosEstado = { ok: 0, cerca: 0, fuera: 0, sin_datos: 0 };
    const fueraMin = { t: 0, hr: 0 };
    const delDia: Lectura[] = [];
    if (hasta <= desde) return { dia, minutos, t: null, hr: null, vpd: null, fueraMin };

    let cubierto = 0;
    while (k < lecturas.length && lecturas[k].ms + tope < desde) k++;
    for (let i = k; i < lecturas.length && lecturas[i].ms < hasta; i++) {
      const l = lecturas[i];
      const siguiente = i + 1 < lecturas.length ? lecturas[i + 1].ms : ahora;
      const ini = Math.max(l.ms, desde);
      const fin = Math.min(siguiente, l.ms + tope, hasta);
      if (l.ms >= desde && l.ms < hasta) delDia.push(l);
      if (fin <= ini) continue;
      const min = (fin - ini) / 60000;
      const estado = estadoLectura(l, u);
      if (estado === 'sin_datos') continue;
      cubierto += min;
      minutos[estado] += min;
      if (esFuera(clasificar(l.t, u.t, MARGENES.t))) fueraMin.t += min;
      if (esFuera(clasificar(l.hr, u.hr, MARGENES.hr))) fueraMin.hr += min;
    }
    minutos.sin_datos = Math.max(0, (hasta - desde) / 60000 - cubierto);
    const redondear = (m: MinutosEstado): MinutosEstado => ({
      ok: Math.round(m.ok),
      cerca: Math.round(m.cerca),
      fuera: Math.round(m.fuera),
      sin_datos: Math.round(m.sin_datos),
    });
    return {
      dia,
      minutos: redondear(minutos),
      t: estadistica(delDia.map((l) => l.t)),
      hr: estadistica(delDia.map((l) => l.hr)),
      vpd: estadistica(delDia.map((l) => l.vpd)),
      fueraMin: { t: Math.round(fueraMin.t), hr: Math.round(fueraMin.hr) },
    };
  });
}

/**
 * Episodios fuera de rango por variable. Un episodio termina con la primera lectura
 * de vuelta en rango o con un hueco mayor que el tope. Primero se descartan los de
 * menos de `minimoMin` (una lectura aislada suele ser ruido del transmisor) y después
 * se unen los del mismo tipo separados por menos de `unionMin`.
 */
export function detectarEpisodios(
  lecturas: Lectura[],
  u: UmbralesZona,
  topeMin: number,
  ahora = Date.now(),
  unionMin = 10,
  minimoMin = 5,
): Episodio[] {
  const tope = topeMin * 60000;
  const salida: Episodio[] = [];

  for (const variable of ['t', 'hr'] as const) {
    const crudos: Episodio[] = [];
    let actual: Episodio | null = null;
    const cerrar = (fin: number, enCurso = false) => {
      if (actual) crudos.push({ ...actual, fin, enCurso });
      actual = null;
    };

    for (let i = 0; i < lecturas.length; i++) {
      const l = lecturas[i];
      const valor = l[variable];
      if (actual && l.ms - lecturas[i - 1].ms > tope) cerrar(lecturas[i - 1].ms + tope);
      const e = clasificar(valor, u[variable], MARGENES[variable]);
      if (valor === null || e === 'sin_dato') continue;
      if (e === 'bajo' || e === 'alto') {
        if (actual && actual.tipo !== e) cerrar(l.ms);
        if (!actual) {
          actual = { variable, tipo: e, inicio: l.ms, fin: l.ms, extremo: valor, enCurso: false };
        } else {
          actual.extremo = e === 'bajo' ? Math.min(actual.extremo, valor) : Math.max(actual.extremo, valor);
        }
      } else if (actual) {
        cerrar(l.ms);
      }
    }
    if (actual) {
      const ultima = lecturas[lecturas.length - 1].ms;
      const enCurso = ahora - ultima <= tope;
      cerrar(enCurso ? ahora : ultima + tope, enCurso);
    }

    const unidos: Episodio[] = [];
    for (const e of crudos.filter((x) => x.enCurso || x.fin - x.inicio >= minimoMin * 60000)) {
      const previo = unidos.at(-1);
      if (previo && previo.tipo === e.tipo && e.inicio - previo.fin < unionMin * 60000) {
        previo.fin = e.fin;
        previo.enCurso = e.enCurso;
        previo.extremo =
          e.tipo === 'bajo' ? Math.min(previo.extremo, e.extremo) : Math.max(previo.extremo, e.extremo);
      } else {
        unidos.push(e);
      }
    }
    salida.push(...unidos);
  }

  return salida.sort((a, b) => b.inicio - a.inicio);
}

/**
 * Inicio del tramo actual fuera de rango, o null. Tolera huecos de hasta el tope más
 * `unionMin`, igual que `detectarEpisodios` al unir episodios.
 */
export function fueraDesde(
  lecturas: Lectura[],
  u: UmbralesZona,
  topeMin: number,
  unionMin = 10,
): number | null {
  const tope = (topeMin + unionMin) * 60000;
  let desde: number | null = null;
  for (let i = lecturas.length - 1; i >= 0; i--) {
    if (estadoLectura(lecturas[i], u) !== 'fuera') break;
    if (i < lecturas.length - 1 && lecturas[i + 1].ms - lecturas[i].ms > tope) break;
    desde = lecturas[i].ms;
  }
  return desde;
}

