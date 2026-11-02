import { Workbook } from 'exceljs';
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

/** Para sumar Banco de Chile basta con agregar su lector aquí. */
const LECTORES_CARTOLA: LectorCartola[] = [new BancoEstadoLector()];

export type ArchivoLeido =
  { clase: 'cartola'; cartola: CartolaLeida } | { clase: 'rcv'; rcv: RcvLeido };

export async function leerArchivo(
  nombre: string,
  buffer: Buffer,
): Promise<ArchivoLeido> {
  const archivo: ArchivoEntrada = { nombre, buffer };

  if (esRcv(archivo)) return { clase: 'rcv', rcv: leerRcv(archivo) };

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
  }

  const lector = LECTORES_CARTOLA.find((l) => l.puedeLeer(archivo));
  if (!lector) {
    throw new ErrorLectura(
      'Formato no reconocido. Se aceptan: cartola histórica de BancoEstado (xlsx) y CSV del RCV del SII.',
    );
  }
  return { clase: 'cartola', cartola: lector.leer(archivo) };
}

/** Los xlsx son zip: empiezan con "PK\x03\x04". */
function esXlsx(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
}
