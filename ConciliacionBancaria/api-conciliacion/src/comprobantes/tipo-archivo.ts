/** Formatos aceptados para un comprobante: fotos del celular y PDF. */
export const FORMATOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
} as const;

export type TipoArchivo = keyof typeof FORMATOS;

/** MIME con que se sirve un archivo guardado, según su extensión. */
export function tipoPorExtension(ruta: string): TipoArchivo | null {
  const ext = ruta.slice(ruta.lastIndexOf('.') + 1).toLowerCase();
  const par = Object.entries(FORMATOS).find(([, e]) => e === ext);
  return par ? (par[0] as TipoArchivo) : null;
}

/**
 * Tipo real del archivo según sus primeros bytes. No se confía en el MIME que manda el
 * navegador: el archivo se vuelve a servir con este tipo, y un HTML disfrazado de foto
 * no debe llegar a mostrarse como página.
 */
export function detectarTipoArchivo(buffer: Buffer): TipoArchivo | null {
  const ascii = (desde: number, hasta: number) =>
    buffer.subarray(desde, hasta).toString('latin1');

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  // HEIC (iPhone): caja "ftyp" con una marca de la familia HEIF.
  if (
    ascii(4, 8) === 'ftyp' &&
    ['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(8, 12))
  )
    return 'image/heic';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  return null;
}
