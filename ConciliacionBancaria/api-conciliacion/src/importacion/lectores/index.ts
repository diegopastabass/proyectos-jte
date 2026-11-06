import { Workbook } from 'exceljs';
import { BancoChileLector } from './bancochile.lector';
import { BancoEstadoLector } from './bancoestado.lector';
import {
  ArchivoEntrada,
  CartolaLeida,
  ErrorLectura,
  LectorCartola,
  RcvLeido,
} from './lector.types';
import { esRcv, leerRcv } from './rcv.lector';

export * from './lector.types';

/** Para sumar otro banco basta con agregar su lector aquí. */
const LECTORES_CARTOLA: LectorCartola[] = [
  new BancoEstadoLector(),
  new BancoChileLector(),
];

export type ArchivoLeido =
  { clase: 'cartola'; cartola: CartolaLeida } | { clase: 'rcv'; rcv: RcvLeido };

export async function leerArchivo(
  nombre: string,
  buffer: Buffer,
): Promise<ArchivoLeido> {
  const archivo: ArchivoEntrada = { nombre, buffer };

  if (esRcv(archivo)) return { clase: 'rcv', rcv: leerRcv(archivo) };

  const problema = formatoNoSoportado(buffer);
  if (problema) throw new ErrorLectura(problema);

  if (esXlsx(buffer)) {
    const libro = new Workbook();
    try {
      await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new ErrorLectura(
        'No se pudo abrir el Excel. ¿Está dañado o protegido con clave?',
      );
    }
    archivo.libro = libro;
  } else {
    // Texto plano (cartola emitida de Banco de Chile, aunque se llame .xls).
    archivo.texto = decodificar(buffer);
  }

  const lector = LECTORES_CARTOLA.find((l) => l.puedeLeer(archivo));
  if (!lector) {
    throw new ErrorLectura(
      'Formato no reconocido. Se aceptan: cartola histórica de BancoEstado (Excel), cartola emitida de ' +
        'Banco de Chile (texto o Excel) y CSV del RCV del SII.',
    );
  }
  return { clase: 'cartola', cartola: lector.leer(archivo) };
}

/** Los xlsx son zip: empiezan con "PK\x03\x04". */
function esXlsx(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
}

/**
 * UTF-8 y, si el archivo no lo es (Banco de Chile puede entregar Windows-1252), latin1.
 * Un BOM al inicio se descarta.
 */
function decodificar(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(buffer)
      .replace(/^\uFEFF/, '');
  } catch {
    return buffer.toString('latin1');
  }
}

/**
 * Archivos que no se pueden leer, con un mensaje que diga qué hacer en vez de «formato no reconocido».
 * Devuelve null si no es ninguno de ellos.
 */
function formatoNoSoportado(buffer: Buffer): string | null {
  const inicio = buffer.subarray(0, 8);
  if (inicio.toString('latin1', 0, 4) === '%PDF') {
    return 'Es un PDF, que no se puede leer. Descargue la cartola en formato Excel o texto.';
  }
  // Excel antiguo (.xls binario, "OLE2"): exceljs solo abre .xlsx.
  if (
    inicio.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    return 'Es un Excel antiguo (.xls binario). Ábralo y guárdelo como .xlsx, o descargue la cartola en formato texto.';
  }
  const cabecera = buffer
    .subarray(0, 2048)
    .toString('latin1')
    .trimStart()
    .toLowerCase();
  if (cabecera.startsWith('<') && /<(table|html)/.test(cabecera)) {
    return 'Es una página web guardada con extensión .xls. Ábralo en Excel y guárdelo como .xlsx, o descargue la cartola en formato texto.';
  }
  return null;
}
