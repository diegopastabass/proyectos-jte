/**
 * Tests de lectores con archivos sintéticos que imitan la estructura real
 * (los archivos reales tienen datos financieros y no van al repositorio).
 */
import { Workbook } from 'exceljs';
import { extraerContraparte, fechaConAnio } from './bancoestado.lector';
import { leerArchivo } from './index';

type FilaMov = [string, number, string, string, string];

async function cartolaBancoEstado(opciones: {
  desde?: string;
  hasta?: string;
  saldoInicial?: string;
  saldoFinal?: string;
  filas: FilaMov[]; // fecha, cargo, abono, saldo, descripción
}): Promise<Buffer> {
  const libro = new Workbook();
  const resumen = libro.addWorksheet('Resumen');
  resumen.getCell('I1').value = '600 660 0033 | soportei@bancoestado.cl';
  const pares: [string, string][] = [
    ['Nombre Empresa', 'EMPRESA DE PRUEBA SPA'],
    ['Rut Empresa', '22.222.222-2'],
    ['Cartóla Histórica de Chequera Electrónica', ''],
    ['N° Cuenta', '12345678901'],
    ['Alias', 'CHEQUERA ELECTRONICA'],
    ['Fecha Inicio', opciones.desde ?? '05/10/2026'],
    ['Fecha Final', opciones.hasta ?? '13/10/2026'],
    ['N° Cartola', '32'],
    ['N° Movimientos', String(opciones.filas.length)],
    ['Saldo Inicial', opciones.saldoInicial ?? '$100.000'],
    ['Saldo Final', opciones.saldoFinal ?? '$141.000'],
  ];
  pares.forEach(([etiqueta, valor], i) => {
    resumen.getCell(5 + i, 1).value = etiqueta;
    if (valor) resumen.getCell(5 + i, 5).value = valor;
  });

  const movs = libro.addWorksheet('Movimientos');
  movs.addRow([
    'Fecha',
    'Sucursal',
    'N° Cuenta',
    'Alias',
    'N° Cartola',
    'N° Operación',
    'Descripción',
    'Cheques / Cargos',
    'Depósitos / Abonos',
    'Saldo',
  ]);
  for (const [fecha, cargo, abono, saldo, glosa] of opciones.filas) {
    // Igual que el banco: cargo numérico, abono y saldo como texto con "$".
    movs.addRow([
      fecha,
      'STGO.PRINCIPAL',
      '12345678901',
      'CHEQUERA ELECTRONICA',
      32,
      '0001077',
      glosa,
      cargo,
      abono,
      saldo,
    ]);
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const FILAS_OK: FilaMov[] = [
  ['05/10', 9000, '$0', '$91.000', 'TEF A COPEC S A'],
  ['07/10', 0, '$50.000', '$141.000', 'TEF DE DE RUT 11111112-K'],
];

describe('BancoEstado xlsx', () => {
  it('lee resumen y movimientos, con año inferido y montos con signo', async () => {
    const r = await leerArchivo(
      'cartola.xlsx',
      await cartolaBancoEstado({ filas: FILAS_OK }),
    );
    expect(r.clase).toBe('cartola');
    if (r.clase !== 'cartola') return;
    const c = r.cartola;
    expect(c).toMatchObject({
      banco: 'bancoestado',
      rutEmpresa: '22222222-2',
      numeroCuenta: '12345678901',
      nCartola: 32,
      desde: '2026-10-05',
      hasta: '2026-10-13',
      saldoInicial: 100000,
      saldoFinal: 141000,
    });
    expect(c.movimientos).toEqual([
      expect.objectContaining({
        fecha: '2026-10-05',
        orden: 1,
        monto: -9000,
        saldo: 91000,
        contraparteTexto: 'COPEC S A',
        rutContraparte: null,
      }),
      expect.objectContaining({
        fecha: '2026-10-07',
        orden: 2,
        monto: 50000,
        saldo: 141000,
        contraparteTexto: null,
        rutContraparte: '11111112-K',
      }),
    ]);
    expect(c.advertencias).toEqual([]);
  });

  it('rechaza una cartola cuyo saldo corrido no cuadra (archivo editado)', async () => {
    const filas: FilaMov[] = [
      FILAS_OK[0],
      ['07/10', 0, '$50.001', '$141.000', 'TEF DE X'],
    ];
    await expect(
      leerArchivo('c.xlsx', await cartolaBancoEstado({ filas })),
    ).rejects.toThrow(/saldo no cuadra/);
  });

  it('rechaza si el saldo final no coincide con el resumen', async () => {
    await expect(
      leerArchivo(
        'c.xlsx',
        await cartolaBancoEstado({ filas: FILAS_OK, saldoFinal: '$1' }),
      ),
    ).rejects.toThrow(/saldo final/);
  });

  it('no reconoce un Excel cualquiera', async () => {
    const libro = new Workbook();
    libro.addWorksheet('Hoja1').addRow(['a', 'b']);
    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    await expect(leerArchivo('otro.xlsx', buffer)).rejects.toThrow(
      /Formato no reconocido/,
    );
  });
});

describe('fechaConAnio', () => {
  it('resuelve el cambio de año dentro del período', () => {
    expect(fechaConAnio('30/12', '2026-12-28', '2027-01-05')).toBe(
      '2026-12-30',
    );
    expect(fechaConAnio('02/01', '2026-12-28', '2027-01-05')).toBe(
      '2027-01-02',
    );
  });

  it('falla si la fecha cae fuera del período', () => {
    expect(() => fechaConAnio('15/11', '2026-10-05', '2026-10-13')).toThrow(
      /fuera del período/,
    );
  });
});

describe('extraerContraparte', () => {
  it.each([
    ['TEF A COPEC S A', 'COPEC S A', null],
    ['TEF BANCOESTADO DE COMITE DE AGUA P', 'COMITE DE AGUA P', null],
    ['TEF DE DE RUT 33333333-3', null, '33333333-3'],
    ['DEPOSITO EN EFECTIVO CAJA VECINA', null, null],
    ['PAGO MOVISTAR RECARGAS', null, null],
  ])('%s', (glosa, texto, rut) => {
    expect(extraerContraparte(glosa)).toEqual({ texto, rut });
  });
});

describe('RCV del SII', () => {
  const ENCABEZADO_VENTA =
    'Nro;Tipo Doc;Tipo Venta;Rut cliente;Razon Social;Folio;Fecha Docto;Fecha Recepcion;Fecha Acuse Recibo;' +
    'Fecha Reclamo;Monto Exento;Monto Neto;Monto IVA;Monto total;IVA Retenido Total;Tipo Docto. Referencia;Folio Docto. Referencia';
  const ENCABEZADO_COMPRA =
    'Nro;Tipo Doc;Tipo Compra;RUT Proveedor;Razon Social;Folio;Fecha Docto;Fecha Recepcion;Fecha Acuse;' +
    'Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Iva No Recuperable;Codigo IVA No Rec.;Monto Total';

  it('lee ventas con nota de crédito referenciada (filas con ";" final)', async () => {
    const csv = [
      ENCABEZADO_VENTA,
      '1;33;Del Giro;44444444-4;CLIENTE UNO;1874;06/10/2026;06/10/2026 10:16:37;;;0;59687;11341;71028;0;;;',
      '2;61;Del Giro;44444444-4;CLIENTE UNO;45;06/10/2026;06/10/2026 10:17:23;;;0;59687;11341;71028;0;33;1874;',
    ].join('\n');
    const r = await leerArchivo(
      'RCV_VENTA_22222222-2_202610.csv',
      Buffer.from('﻿' + csv),
    );
    expect(r.clase).toBe('rcv');
    if (r.clase !== 'rcv') return;
    expect(r.rcv).toMatchObject({
      tipo: 'rcv_venta',
      rutEmpresa: '22222222-2',
      periodo: '202610',
    });
    expect(r.rcv.documentos[0]).toMatchObject({
      tipoDte: 33,
      folio: 1874,
      montoTotal: 71028,
      refFolio: null,
    });
    expect(r.rcv.documentos[1]).toMatchObject({
      tipoDte: 61,
      folio: 45,
      refTipoDte: 33,
      refFolio: 1874,
      fechaRecepcion: '2026-10-06 10:17:23',
    });
  });

  it('lee compras sumando IVA recuperable y no recuperable', async () => {
    const csv = [
      ENCABEZADO_COMPRA,
      '1;33;Del Giro;55555555-5;PROVEEDOR SPA;54643;25/09/2026;25/09/2026 14:50:44;;0;216880;41207;100;;258187;',
    ].join('\n');
    const r = await leerArchivo(
      'RCV_COMPRA_REGISTRO_22222222-2_202610.csv',
      Buffer.from(csv),
    );
    if (r.clase !== 'rcv') throw new Error('se esperaba RCV');
    expect(r.rcv.tipo).toBe('rcv_compra');
    expect(r.rcv.documentos[0]).toMatchObject({
      montoNeto: 216880,
      montoIva: 41307,
      montoTotal: 258187,
    });
  });

  it('rechaza el RCV de compras RECLAMADO', async () => {
    const csv = [
      ENCABEZADO_COMPRA,
      '1;33;Del Giro;55555555-5;PROVEEDOR SPA;1;25/09/2026;;;0;100;19;;;119;',
    ].join('\n');
    await expect(
      leerArchivo(
        'RCV_COMPRA_RECLAMADO_22222222-2_202610.csv',
        Buffer.from(csv),
      ),
    ).rejects.toThrow(/RECLAMADO/);
  });

  it('omite con advertencia filas con RUT inválido', async () => {
    const csv = [
      ENCABEZADO_COMPRA,
      '1;33;Del Giro;55555555-1;MAL RUT;1;25/09/2026;;;0;100;19;;;119;',
    ].join('\n');
    const r = await leerArchivo('compras.csv', Buffer.from(csv));
    if (r.clase !== 'rcv') throw new Error('se esperaba RCV');
    expect(r.rcv.documentos).toHaveLength(0);
    expect(r.rcv.advertencias.join(' ')).toMatch(/RUT "55555555-1" inválido/);
  });
});
