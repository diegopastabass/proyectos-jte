import type { Workbook } from 'exceljs';

export type Banco = 'bancoestado' | 'banco_chile';

export interface ArchivoEntrada {
  nombre: string;
  buffer: Buffer;
  /** Libro ya abierto si el archivo es xlsx (se abre una sola vez para todos los lectores). */
  libro?: Workbook;
  /** Contenido ya decodificado si el archivo es texto plano (ej. la cartola emitida de Banco de Chile). */
  texto?: string;
}

export interface MovimientoLeido {
  fecha: string; // YYYY-MM-DD
  orden: number; // posición en la cartola, desde 1
  monto: number; // + abono, − cargo
  saldo: number | null;
  glosa: string;
  nOperacion: string | null;
  sucursal: string | null;
  contraparteTexto: string | null;
  rutContraparte: string | null;
}

export interface CartolaLeida {
  banco: Banco;
  lector: string;
  rutEmpresa: string | null;
  numeroCuenta: string;
  aliasCuenta: string | null;
  desde: string;
  hasta: string;
  nCartola: number | null;
  saldoInicial: number | null;
  saldoFinal: number | null;
  movimientos: MovimientoLeido[];
  advertencias: string[];
}

export interface LectorCartola {
  readonly nombre: string;
  readonly banco: Banco;
  puedeLeer(archivo: ArchivoEntrada): boolean;
  leer(archivo: ArchivoEntrada): CartolaLeida;
}

export type TipoRcv = 'rcv_compra' | 'rcv_venta';

export interface DocumentoLeido {
  tipoDte: number;
  folio: number;
  rutContraparte: string;
  razonSocial: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaRecepcion: string | null; // 'YYYY-MM-DD HH:MM:SS' hora de Chile
  montoExento: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  refTipoDte: number | null;
  refFolio: number | null;
}

export interface RcvLeido {
  tipo: TipoRcv;
  lector: string;
  rutEmpresa: string | null; // del nombre del archivo, si viene
  periodo: string | null; // YYYYMM, del nombre del archivo
  desde: string | null;
  hasta: string | null;
  documentos: DocumentoLeido[];
  advertencias: string[];
}

/** Error de formato del archivo: se informa al usuario tal cual (400). */
export class ErrorLectura extends Error {}
