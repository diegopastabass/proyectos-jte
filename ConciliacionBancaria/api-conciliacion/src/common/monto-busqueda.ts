/** Diferencia máxima (en pesos) entre el monto buscado y el de un movimiento o documento. */
export const MARGEN_MONTO_CLP = 1000;

/**
 * Si lo escrito en el buscador es un monto ("5500CLP", "$5.500", "5.500 clp") devuelve los pesos.
 * Exige "$" o "CLP" para no confundirlo con un folio, un N° de operación o un número dentro de la glosa.
 */
export function montoDeBusqueda(q: string | null | undefined): number | null {
  const m = /^(\$)?\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*(clp)?$/i.exec(
    (q ?? '').trim(),
  );
  if (!m || (!m[1] && !m[3])) return null;
  return Number(m[2].replace(/\./g, ''));
}

/**
 * Condición SQL para acotar `columna` (valor absoluto) a ±MARGEN_MONTO_CLP del monto buscado, y
 * expresión de distancia para ordenar de más a menos parecido. `param` es el nombre del parámetro
 * (":monto" en TypeORM, "$3" en SQL directo) que lleva el monto buscado.
 */
export function porCercaniaDeMonto(columna: string, param: string) {
  const distancia = `ABS(ABS(${columna}) - ${param})`;
  return { donde: `${distancia} <= ${MARGEN_MONTO_CLP}`, distancia };
}
