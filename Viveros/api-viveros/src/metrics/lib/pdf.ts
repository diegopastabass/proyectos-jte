import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// Fuentes estándar de PDF: no requieren archivos y cubren tildes, ñ, ° y ³.
const FUENTES = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

/**
 * Genera el PDF con la versión de pdfmake que esté instalada:
 * - 0.3: `require('pdfmake')` es una instancia con `setFonts` y `createPdf(doc).getBuffer()`;
 * - 0.2: es la clase `PdfPrinter`, con `createPdfKitDocument(doc)` (un stream).
 * Se carga recién al generar, para que un problema con pdfmake nunca impida arrancar la API
 * (en el servidor quedó la 0.2 aunque el lock pide la 0.3 y la API respondía 502).
 */
export async function generarPdf(
  doc: TDocumentDefinitions,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cargar: () => unknown = () => require('pdfmake'),
): Promise<Buffer> {
  const lib = cargar() as { default?: unknown };
  const pdfmake = (lib.default ?? lib) as any;

  if (typeof pdfmake?.setFonts === 'function' && typeof pdfmake?.createPdf === 'function') {
    pdfmake.setFonts(FUENTES);
    return Buffer.from(await pdfmake.createPdf(doc).getBuffer());
  }

  if (typeof pdfmake === 'function') {
    const printer = new pdfmake(FUENTES);
    const pdf = printer.createPdfKitDocument(doc);
    const partes: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      pdf.on('data', (p: Buffer) => partes.push(p));
      pdf.on('end', () => resolve(Buffer.concat(partes)));
      pdf.on('error', reject);
      pdf.end();
    });
  }

  throw new Error('Versión de pdfmake no soportada (se esperaba 0.2 o 0.3)');
}
