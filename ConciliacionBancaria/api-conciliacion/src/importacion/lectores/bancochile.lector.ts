import { normalizarRut, extraerRut } from '../../common/rut';
import {
  normalizarTexto,
  parsearFechaDdMmAaaa,
  parsearMonto,
} from '../../common/texto';
import { filas as filasDeHoja, type ValorCelda } from './excel.util';
import {
  type ArchivoEntrada,
  type CartolaLeida,
  ErrorLectura,
  type LectorCartola,
  type MovimientoLeido,
} from './lector.types';
import { validarSaldos } from './saldo.util';

/**
 * "Cartola emitida" de la cuenta corriente de Banco de Chile (portal empresas).
 *
 * Llega como texto plano separado por ";" (aunque se descargue con extensión .xls) y, por si el
 * banco la entrega como Excel, también como xlsx con las mismas columnas. Por eso se detecta por el
 * contenido y no por la extensión.
 *
 *   Servicios Automatizacion Eduardo Martinez Es(076907914-9) cta:000250614808
 *   Fecha;Detalle Movimiento;Cheque o Cargo;Deposito o Abono;Saldo;Docto. Nro.;Trn;Caja;Sucursal
 *   01/10/2026;APP-TRASPASO A:Luis Valenzuela   ;+0000500000;00000000000;-0000000500000;0000...;INTERNET
 *
 * Particularidades observadas:
 * - La fecha trae el año. Los montos van con signo y ceros a la izquierda ("+0000500000").
 * - No trae N° de cartola, período ni saldo inicial/final: se deducen del saldo corrido, que se valida
 *   fila a fila igual que en BancoEstado.
 * - El saldo puede ser negativo (cuenta con línea de crédito o sobregiro).
 * - "Detalle" mide 40 caracteres incluido el prefijo, así que los nombres vienen cortados.
 * - "Docto. Nro.", "Trn" y "Caja" vienen en cero: no hay N° de operación.
 * - El RUT de la cabecera y el de la glosa de "PAGO:PROVEEDORES" llevan un cero delante.
 */

/** Columnas que identifican el formato (normalizadas), y las obligatorias para leerlo. */
const COLUMNAS = {
  fecha: 'FECHA',
  detalle: 'DETALLE MOVIMIENTO',
  cargo: 'CHEQUE O CARGO',
  abono: 'DEPOSITO O ABONO',
  saldo: 'SALDO',
};
const OPCIONALES = { docto: 'DOCTO NRO', sucursal: 'SUCURSAL' };

const RE_TITULO = /\(\s*([\d.]+-[\dkK])\s*\)\s*cta\s*[:.]?\s*(\d[\d.\-\s]*)/i;

export class BancoChileLector implements LectorCartola {
  readonly nombre = 'bancochile';
  readonly banco = 'banco_chile' as const;

  puedeLeer(archivo: ArchivoEntrada): boolean {
    return fuentes(archivo).some((f) => buscarEncabezado(f.filas) >= 0);
  }

  leer(archivo: ArchivoEntrada): CartolaLeida {
    const fuente = fuentes(archivo).find((f) => buscarEncabezado(f.filas) >= 0);
    if (!fuente) throw new ErrorLectura('No es una cartola de Banco de Chile');
    const { filas, origen } = fuente;
    const iEnc = buscarEncabezado(filas);
    const advertencias: string[] = [];

    // --- Cabecera: RUT de la empresa y número de cuenta
    const titulo = filas
      .slice(0, iEnc)
      .map((f) => f.map(texto).filter(Boolean).join(' '))
      .map((t) => RE_TITULO.exec(t))
      .find((m) => m !== null);
    if (!titulo) {
      throw new ErrorLectura(
        'No se encontró el RUT y el número de cuenta en la cabecera de la cartola ' +
          '(se espera algo como "Empresa(076907914-9) cta:000250614808")',
      );
    }
    const rutEmpresa = normalizarRut(titulo[1]);
    if (!rutEmpresa) {
      advertencias.push(
        `El RUT de la cabecera (${titulo[1]}) no es válido: no se pudo comprobar que la cartola sea de esta empresa`,
      );
    }
    // Sin ceros a la izquierda ni separadores, para que la misma cuenta no se duplique entre formatos.
    const numeroCuenta = titulo[2].replace(/\D/g, '').replace(/^0+/, '');
    if (!numeroCuenta) throw new ErrorLectura('Número de cuenta inválido');

    // --- Columnas
    const nombres = filas[iEnc].map((c) => normalizarTexto(texto(c)));
    const col = (n: string) => nombres.indexOf(n);
    const iFecha = col(COLUMNAS.fecha);
    const iDetalle = col(COLUMNAS.detalle);
    const iCargo = col(COLUMNAS.cargo);
    const iAbono = col(COLUMNAS.abono);
    const iSaldo = col(COLUMNAS.saldo);
    const iDocto = col(OPCIONALES.docto);
    const iSucursal = col(OPCIONALES.sucursal);

    // --- Movimientos
    const movimientos: MovimientoLeido[] = [];
    filas.slice(iEnc + 1).forEach((fila, i) => {
      const nFila = i + 1;
      const fechaTexto = texto(fila[iFecha]);
      // Filas sin fecha (vacías, totales, notas al pie): si faltara un movimiento real, el saldo
      // corrido dejaría de cuadrar y la cartola se rechaza más abajo.
      if (
        !/^\d{2}\/\d{2}\/\d{4}/.test(fechaTexto) &&
        !(fila[iFecha] instanceof Date)
      )
        return;
      try {
        const fecha =
          fila[iFecha] instanceof Date
            ? fila[iFecha].toISOString().slice(0, 10)
            : parsearFechaDdMmAaaa(fechaTexto);
        const cargo = parsearMonto(fila[iCargo]);
        const abono = parsearMonto(fila[iAbono]);
        if (cargo < 0 || abono < 0) throw new Error('trae un monto negativo');
        if (cargo !== 0 && abono !== 0)
          throw new Error('trae cargo y abono a la vez');
        const glosa = texto(fila[iDetalle]);
        const monto = abono - cargo;
        if (monto === 0) {
          advertencias.push(
            `Fila ${nFila}: movimiento en $0 omitido ("${glosa}")`,
          );
          return;
        }
        const contraparte = extraerContraparte(glosa);
        const docto = iDocto >= 0 ? texto(fila[iDocto]).replace(/^0+/, '') : '';
        movimientos.push({
          fecha,
          orden: movimientos.length + 1,
          monto,
          saldo:
            iSaldo >= 0 && texto(fila[iSaldo]) !== ''
              ? parsearMonto(fila[iSaldo])
              : null,
          glosa,
          nOperacion: docto || null,
          sucursal: (iSucursal >= 0 ? texto(fila[iSucursal]) : '') || null,
          contraparteTexto: contraparte.texto,
          rutContraparte: contraparte.rut,
        });
      } catch (e) {
        throw new ErrorLectura(
          `Cartola de Banco de Chile (${origen}), movimiento ${nFila}: ${(e as Error).message}`,
        );
      }
    });

    if (movimientos.length === 0) {
      throw new ErrorLectura('La cartola no trae movimientos');
    }

    // Cartolas ordenadas del más nuevo al más antiguo: se dan vuelta para encadenar los saldos.
    if (movimientos[0].fecha > movimientos[movimientos.length - 1].fecha) {
      movimientos.reverse();
      movimientos.forEach((m, i) => (m.orden = i + 1));
    }

    // Sin saldo inicial/final en el archivo: se deducen del saldo corrido (y se valida toda la cadena).
    const primero = movimientos[0];
    const ultimo = movimientos[movimientos.length - 1];
    const saldoInicial =
      primero.saldo !== null ? primero.saldo - primero.monto : null;
    const saldoFinal = ultimo.saldo;
    validarSaldos(movimientos, saldoInicial, saldoFinal);

    const fechas = movimientos.map((m) => m.fecha).sort();
    return {
      banco: this.banco,
      lector: origen === 'texto' ? 'bancochile_texto' : 'bancochile_xlsx',
      rutEmpresa,
      numeroCuenta,
      aliasCuenta: null,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      nCartola: null,
      saldoInicial,
      saldoFinal,
      movimientos,
      advertencias,
    };
  }
}

/**
 * Contraparte según el prefijo de la glosa:
 *   "APP-TRASPASO A:Luis Valenzuela", "TRASPASO DE:COMERCIAL E IMPORTADOR" → el nombre
 *   "PAGO:PEAJE NUEVO ANGOS" → el comercio
 *   "PAGO:PROVEEDORES 0765177979" → sin nombre, pero con el RUT del que pagó
 * Las operaciones del banco (comisiones, línea de crédito, giros) no tienen contraparte.
 */
export function extraerContraparte(glosa: string): {
  texto: string | null;
  rut: string | null;
} {
  const proveedores = /^PAGO:\s*PROVEEDORES\s+(\d{9,10})\s*$/i.exec(glosa);
  if (proveedores) return { texto: null, rut: normalizarRut(proveedores[1]) };

  const m = /^(?:(?:APP-)?TRASPASO\s+(?:A|DE)|PAGO)\s*:\s*(.+)$/i.exec(glosa);
  if (!m) return { texto: null, rut: null };
  const texto = m[1].trim();
  return { texto: texto || null, rut: extraerRut(texto) };
}

// ----------------------------------------------------------------- Lectura de la fuente

interface Fuente {
  origen: 'texto' | 'xlsx';
  filas: ValorCelda[][];
}

/** Las "tablas" que se pueden leer del archivo: el texto, o cada hoja del Excel. */
function fuentes(archivo: ArchivoEntrada): Fuente[] {
  if (archivo.texto !== undefined) {
    const filas = archivo.texto
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .map((l) => l.split(';') as ValorCelda[]);
    return [{ origen: 'texto', filas }];
  }
  return (archivo.libro?.worksheets ?? []).map((hoja) => ({
    origen: 'xlsx' as const,
    filas: filasDeHoja(hoja),
  }));
}

/** Índice de la fila de encabezado (la que tiene las columnas del formato), o -1. */
function buscarEncabezado(filas: ValorCelda[][]): number {
  const limite = Math.min(filas.length, 15);
  for (let i = 0; i < limite; i++) {
    const nombres = filas[i].map((c) => normalizarTexto(texto(c)));
    if (Object.values(COLUMNAS).every((n) => nombres.includes(n))) return i;
  }
  return -1;
}

function texto(v: ValorCelda | undefined): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}
