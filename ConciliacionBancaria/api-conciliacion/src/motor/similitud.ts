import { normalizarTexto } from '../common/texto';

/**
 * Palabras que no distinguen a una contraparte (artículos y formas societarias).
 * "COPEC S A" y "COPEC S.A." quedan ambas como ["COPEC"].
 */
const PALABRAS_VACIAS = new Set([
  'A',
  'E',
  'Y',
  'S',
  'DE',
  'DEL',
  'LA',
  'LAS',
  'LOS',
  'EL',
  'EN',
  'SA',
  'SPA',
  'LTDA',
  'LTD',
  'LIMITADA',
  'EIRL',
  'CIA',
  'COMPANIA',
  'SOC',
  'SOCIEDAD',
  'EMPRESA',
  'INDIVIDUAL',
  'RESPONSABILIDAD',
  'AG',
]);

export function palabras(texto: string | null | undefined): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter((p) => p && !PALABRAS_VACIAS.has(p));
}

/**
 * Palabras de una glosa bancaria. BancoEstado corta la glosa a ~35 caracteres, así que la última
 * palabra suele venir truncada ("RANGU", "AUQUINC"); si quedó en 1-2 letras no aporta y se descarta.
 */
export function palabrasGlosa(texto: string | null | undefined): string[] {
  return analizarGlosa(texto).palabras;
}

/**
 * Separa la inicial suelta del final ("MARTINEZ ESPINA L" → palabras [MARTINEZ, ESPINA], inicial "L").
 * La inicial no suma parecido, pero descarta: "MARTINEZ ESPINA L" no es "MARTINEZ ESPINA EDUARDO".
 */
function analizarGlosa(texto: string | null | undefined): {
  palabras: string[];
  inicial: string | null;
} {
  const p = palabras(texto);
  if (p.length > 1 && p[p.length - 1].length <= 2) {
    const inicial = p.pop()!;
    return { palabras: p, inicial };
  }
  return { palabras: p, inicial: null };
}

/**
 * ¿La palabra de la glosa corresponde a la del nombre? Exacta, o prefijo: la última palabra
 * (truncada) desde 3 letras, y cualquier otra desde 4 (abreviaturas: COOP → COOPERATIVA).
 */
function coincide(
  deGlosa: string,
  deNombre: string,
  esUltima: boolean,
): boolean {
  if (deGlosa === deNombre) return true;
  const minimo = esUltima ? 3 : 4;
  return deGlosa.length >= minimo && deNombre.startsWith(deGlosa);
}

export interface Candidato {
  id: number;
  similitud: number; // 0..1
  /** La glosa es el comienzo del nombre, en orden (ej. "SERVICIOS AUTOMATIZACION EDUA"). */
  prefijo: boolean;
  /** Coincidió una palabra (de 4+ letras) que ninguna otra contraparte tiene, ej. "AUQUINC". */
  distintiva: boolean;
}

/**
 * Compara el texto de una glosa con los nombres de las contrapartes.
 * Cada palabra pesa según qué tan rara es entre las contrapartes (IDF): en
 * "COOP DE AGUA POTABLE AUQUINC", "AUQUINC" identifica y "AGUA POTABLE" casi no.
 */
export class IndiceNombres {
  private readonly entradas: { id: number; palabras: string[] }[];

  constructor(nombres: { id: number; nombre: string }[]) {
    this.entradas = nombres
      .map((n) => ({ id: n.id, palabras: palabras(n.nombre) }))
      .filter((e) => e.palabras.length > 0);
  }

  buscar(texto: string | null | undefined, ids?: Set<number>): Candidato[] {
    const { palabras: g, inicial } = analizarGlosa(texto);
    if (g.length === 0) return [];
    const ultima = g.length - 1;
    const entradas = ids
      ? this.entradas.filter((e) => ids.has(e.id))
      : this.entradas;
    const total = this.entradas.length;

    const df = g.map(
      (p, i) =>
        this.entradas.filter((e) =>
          e.palabras.some((n) => coincide(p, n, i === ultima)),
        ).length,
    );
    const pesos = df.map((d) => Math.log(1 + total / (1 + d)));
    const pesoTotal = pesos.reduce((a, b) => a + b, 0);

    const resultado: Candidato[] = [];
    for (const e of entradas) {
      let peso = 0;
      let distintiva = false;
      g.forEach((p, i) => {
        if (e.palabras.some((n) => coincide(p, n, i === ultima))) {
          peso += pesos[i];
          if (df[i] === 1 && p.length >= 4) distintiva = true;
        }
      });
      if (peso === 0) continue;
      // La inicial truncada debe corresponder a alguna palabra del nombre; si no, es otra contraparte.
      if (inicial && !e.palabras.some((n) => n.startsWith(inicial))) peso /= 2;
      const prefijo =
        g.length <= e.palabras.length &&
        g.every((p, i) => coincide(p, e.palabras[i], i === ultima));
      resultado.push({
        id: e.id,
        similitud: redondear(peso / pesoTotal),
        prefijo,
        distintiva,
      });
    }
    return resultado.sort((a, b) => b.similitud - a.similitud);
  }
}

/**
 * Clave con que se aprende "lo que dice la glosa → contraparte": el nombre normalizado, o el RUT
 * cuando la glosa solo trae RUT (ej. una administración que paga por un condominio).
 */
export function patronAlias(
  texto: string | null | undefined,
  rut: string | null | undefined,
): string | null {
  const t = normalizarTexto(texto);
  if (t) return t;
  return rut ? `RUT ${rut}` : null;
}

export function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}
