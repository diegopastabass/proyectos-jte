/** Mayúsculas, sin tildes (Ñ → N), solo letras/números/espacios y espacios colapsados. */
export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte un monto escrito como "$1.042.542", "-$5.000", "1.234" o un número
 * a entero (pesos). Lanza error si no se puede interpretar, para no importar basura.
 */
export function parsearMonto(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor))
      throw new Error(`Monto con decimales: ${valor}`);
    return valor;
  }
  if (typeof valor !== 'string')
    throw new Error(`Monto inválido: ${typeof valor}`);
  // El signo "+" va delante en algunas cartolas ("+0000500000"); no suma nada.
  const texto = valor.trim().replace(/^\+\s*/, '');
  const negativo = texto.includes('-');
  const digitos = texto.replace(/[$\s.-]/g, '');
  if (!/^\d+$/.test(digitos)) throw new Error(`Monto inválido: "${texto}"`);
  const n = Number(digitos);
  return negativo ? -n : n;
}

/** "25/09/2026" → "2026-09-25". Lanza error si la fecha no existe. */
export function parsearFechaDdMmAaaa(texto: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto.trim());
  if (!m) throw new Error(`Fecha inválida: "${texto}"`);
  return fechaIso(Number(m[3]), Number(m[2]), Number(m[1]));
}

const formatoChile = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Santiago',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Minutos de diferencia entre la hora de Chile y UTC en ese instante (−180 o −240). */
function desfaseChile(instante: number): number {
  const p = Object.fromEntries(
    formatoChile.formatToParts(instante).map((x) => [x.type, Number(x.value)]),
  );
  return (
    (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
      instante) /
    60000
  );
}

/** "2026-09-25 14:50:44" en hora de Chile (con horario de verano) → Date. */
export function horaChileADate(texto: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(texto);
  if (!m) throw new Error(`Fecha-hora inválida: "${texto}"`);
  const [anio, mes, dia, h, mi, s] = m.slice(1).map(Number);
  const comoUtc = Date.UTC(anio, mes - 1, dia, h, mi, s);
  let instante = comoUtc - desfaseChile(comoUtc) * 60000;
  // Segunda pasada por si el primer intento cayó al otro lado de un cambio de horario.
  instante = comoUtc - desfaseChile(instante) * 60000;
  return new Date(instante);
}

export function fechaIso(anio: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    d.getUTCFullYear() !== anio ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    throw new Error(`Fecha inexistente: ${dia}/${mes}/${anio}`);
  }
  return d.toISOString().slice(0, 10);
}
