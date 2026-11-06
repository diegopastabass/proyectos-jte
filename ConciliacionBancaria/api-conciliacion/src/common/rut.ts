/** Dígito verificador (módulo 11) del cuerpo de un RUT. */
export function calcularDv(cuerpo: number): string {
  let suma = 0;
  let multiplicador = 2;
  for (let n = cuerpo; n > 0; n = Math.floor(n / 10)) {
    suma += (n % 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const dv = 11 - (suma % 11);
  return dv === 11 ? '0' : dv === 10 ? 'K' : String(dv);
}

/**
 * Normaliza un RUT a "12345678-K" (sin puntos, DV en mayúscula).
 * Devuelve null si no tiene formato de RUT o si el dígito verificador no cuadra.
 * Acepta ceros a la izquierda, como los escribe Banco de Chile: "076907914-9", "0765177979".
 */
export function normalizarRut(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpio = texto.replace(/[.\s]/g, '').toUpperCase();
  const m = /^0*(\d{1,8})-?([\dK])$/.exec(limpio);
  if (!m) return null;
  const cuerpo = Number(m[1]);
  if (cuerpo < 1_000_000) return null;
  return calcularDv(cuerpo) === m[2] ? `${cuerpo}-${m[2]}` : null;
}

/** Busca el primer RUT válido dentro de un texto libre (ej. una glosa bancaria). */
export function extraerRut(texto: string): string | null {
  const candidatos =
    texto.toUpperCase().match(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dK]\b/g) ?? [];
  for (const c of candidatos) {
    const rut = normalizarRut(c);
    if (rut) return rut;
  }
  return null;
}
