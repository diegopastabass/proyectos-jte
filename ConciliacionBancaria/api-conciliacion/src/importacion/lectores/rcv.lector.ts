import { parse } from 'csv-parse/sync';
import { normalizarRut } from '../../common/rut';
import {
  normalizarTexto,
  parsearFechaDdMmAaaa,
  parsearMonto,
} from '../../common/texto';
import {
  ArchivoEntrada,
  DocumentoLeido,
  ErrorLectura,
  RcvLeido,
  TipoRcv,
} from './lector.types';

/**
 * CSV del Registro de Compras y Ventas descargado desde el portal del SII.
 *
 * Nombres de archivo observados:
 *   RCV_COMPRA_REGISTRO_76907914-9_202610.csv
 *   RCV_VENTA_76907914-9_202610.csv
 * Separador ";", montos enteros sin separador de miles, fechas dd/mm/aaaa, y las filas de
 * datos terminan en ";" (traen una columna más que el encabezado).
 *
 * En ventas, las notas de crédito/débito traen "Tipo Docto. Referencia" y "Folio Docto. Referencia".
 * En compras no viene la referencia.
 */
export const LECTOR_RCV = 'sii_rcv_csv';

const RE_NOMBRE =
  /RCV_(COMPRA|VENTA)_(?:([A-Z_]+?)_)?(\d{7,8}-[\dkK])_(\d{6})/i;

/** Estados del RCV de compras que se aceptan. RECLAMADO y NO_INCLUIR no son deuda real. */
const ESTADOS_COMPRA_ACEPTADOS = ['REGISTRO', 'PENDIENTE'];

export function esRcv(archivo: ArchivoEntrada): boolean {
  if (!/\.csv$/i.test(archivo.nombre)) return false;
  const encabezado = normalizarTexto(primeraLinea(archivo.buffer));
  return (
    encabezado.includes('TIPO DOC') &&
    (encabezado.includes('RUT PROVEEDOR') || encabezado.includes('RUT CLIENTE'))
  );
}

export function leerRcv(archivo: ArchivoEntrada): RcvLeido {
  const advertencias: string[] = [];
  const filas: string[][] = parse(archivo.buffer, {
    delimiter: ';',
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (filas.length === 0) throw new ErrorLectura('El archivo está vacío');

  const encabezado = filas[0].map((c) => normalizarTexto(c));
  const tipo: TipoRcv = encabezado.includes('RUT PROVEEDOR')
    ? 'rcv_compra'
    : 'rcv_venta';

  const nombre = RE_NOMBRE.exec(archivo.nombre);
  if (nombre) {
    const esperado =
      nombre[1].toUpperCase() === 'COMPRA' ? 'rcv_compra' : 'rcv_venta';
    if (esperado !== tipo)
      throw new ErrorLectura(
        'El nombre del archivo no coincide con su contenido (compra/venta)',
      );
    const estado = nombre[2]?.toUpperCase();
    if (
      tipo === 'rcv_compra' &&
      estado &&
      !ESTADOS_COMPRA_ACEPTADOS.includes(estado)
    ) {
      throw new ErrorLectura(
        `Es el RCV de compras "${estado}". Solo se importan REGISTRO y PENDIENTE: ` +
          'los documentos reclamados o no incluidos no son deuda real.',
      );
    }
    if (estado === 'PENDIENTE') {
      advertencias.push(
        'Son documentos PENDIENTES de acuse en el SII: pueden terminar reclamados.',
      );
    }
  } else {
    advertencias.push(
      'El nombre del archivo no sigue el formato del SII; no se pudo validar RUT ni período.',
    );
  }

  const col = (nombreColumna: string, obligatoria = true): number => {
    const i = encabezado.indexOf(nombreColumna);
    if (i < 0 && obligatoria)
      throw new ErrorLectura(`Falta la columna "${nombreColumna}"`);
    return i;
  };
  const c = {
    tipoDoc: col('TIPO DOC'),
    rut: col(tipo === 'rcv_compra' ? 'RUT PROVEEDOR' : 'RUT CLIENTE'),
    razonSocial: col('RAZON SOCIAL'),
    folio: col('FOLIO'),
    fechaDocto: col('FECHA DOCTO'),
    fechaRecepcion: col('FECHA RECEPCION', false),
    exento: col('MONTO EXENTO'),
    neto: col('MONTO NETO'),
    total: col('MONTO TOTAL'),
    // Compras separa IVA recuperable y no recuperable; ventas trae un solo "Monto IVA".
    iva: col(tipo === 'rcv_compra' ? 'MONTO IVA RECUPERABLE' : 'MONTO IVA'),
    ivaNoRec:
      tipo === 'rcv_compra' ? col('MONTO IVA NO RECUPERABLE', false) : -1,
    refTipo: col('TIPO DOCTO REFERENCIA', false),
    refFolio: col('FOLIO DOCTO REFERENCIA', false),
  };

  const documentos: DocumentoLeido[] = [];
  filas.slice(1).forEach((fila, i) => {
    const nFila = i + 2;
    const celda = (indice: number) => (indice >= 0 ? (fila[indice] ?? '') : '');
    try {
      const rut = normalizarRut(celda(c.rut));
      if (!rut) {
        advertencias.push(
          `Fila ${nFila}: RUT "${celda(c.rut)}" inválido, fila omitida`,
        );
        return;
      }
      const folio = Number(celda(c.folio));
      if (!Number.isInteger(folio) || folio <= 0) {
        advertencias.push(
          `Fila ${nFila}: folio "${celda(c.folio)}" inválido, fila omitida`,
        );
        return;
      }
      const refFolio = Number(celda(c.refFolio)) || null;
      documentos.push({
        tipoDte: Number(celda(c.tipoDoc)),
        folio,
        rutContraparte: rut,
        razonSocial: celda(c.razonSocial),
        fechaEmision: parsearFechaDdMmAaaa(celda(c.fechaDocto)),
        fechaRecepcion: fechaHora(celda(c.fechaRecepcion)),
        montoExento: parsearMonto(celda(c.exento)),
        montoNeto: parsearMonto(celda(c.neto)),
        montoIva: parsearMonto(celda(c.iva)) + parsearMonto(celda(c.ivaNoRec)),
        montoTotal: parsearMonto(celda(c.total)),
        refTipoDte: refFolio ? Number(celda(c.refTipo)) || null : null,
        refFolio,
      });
    } catch (e) {
      throw new ErrorLectura(`Fila ${nFila}: ${(e as Error).message}`);
    }
  });

  const fechas = documentos.map((d) => d.fechaEmision).sort();
  return {
    tipo,
    lector: LECTOR_RCV,
    rutEmpresa: nombre ? normalizarRut(nombre[3]) : null,
    periodo: nombre?.[4] ?? null,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    documentos,
    advertencias,
  };
}

function primeraLinea(buffer: Buffer): string {
  const inicio = buffer
    .subarray(0, 4096)
    .toString('utf8')
    .replace(/^\uFEFF/, '');
  return inicio.split(/\r?\n/)[0] ?? '';
}

/** "25/09/2026 14:50:44" → "2026-09-25 14:50:44" (hora de Chile). */
function fechaHora(texto: string): string | null {
  const m = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})$/.exec(texto);
  return m ? `${parsearFechaDdMmAaaa(m[1])} ${m[2]}` : null;
}
