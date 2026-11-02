import type { Cell, Worksheet } from 'exceljs';

export type ValorCelda = string | number | Date | null;

/** Valor "plano" de una celda de exceljs (texto enriquecido, fórmulas, hipervínculos). */
export function valorCelda(celda: Cell | undefined): ValorCelda {
  const v = celda?.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || v instanceof Date)
    return v;
  if (typeof v === 'boolean') return String(v);
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('result' in v) return (v.result as ValorCelda) ?? null;
  if ('text' in v) return String(v.text);
  return null;
}

export function textoCelda(celda: Cell | undefined): string {
  const v = valorCelda(celda);
  if (v === null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Filas de una hoja como arreglos de valores (índice 0 = columna A). */
export function filas(hoja: Worksheet): ValorCelda[][] {
  const resultado: ValorCelda[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: ValorCelda[] = [];
    for (let c = 1; c <= hoja.columnCount; c++)
      valores.push(valorCelda(fila.getCell(c)));
    resultado.push(valores);
  });
  return resultado;
}
