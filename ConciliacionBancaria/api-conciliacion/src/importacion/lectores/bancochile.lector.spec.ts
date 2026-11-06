/**
 * Tests del lector de Banco de Chile con archivos sintéticos que imitan la estructura real
 * (el archivo real tiene datos financieros y no va al repositorio). RUT, nombres y cuenta son inventados.
 */
import { Workbook } from 'exceljs';
import { extraerContraparte } from './bancochile.lector';
import { leerArchivo, type CartolaLeida } from './index';

const TITULO = 'Empresa de Prueba SpA(022222222-2) cta:000123456789';
const ENCABEZADO =
  'Fecha;Detalle Movimiento;Cheque o Cargo;Deposito o Abono;Saldo;Docto. Nro.;Trn;Caja;Sucursal';

/** Una fila con el ancho y los signos del banco. */
function fila(
  fecha: string,
  detalle: string,
  cargo: number,
  abono: number,
  saldo: number,
  sucursal = 'INTERNET',
): string {
  const c = cargo ? `+${String(cargo).padStart(10, '0')}` : '00000000000';
  const a = abono ? `+${String(abono).padStart(10, '0')}` : '00000000000';
  const s = `${saldo < 0 ? '-' : '+'}${String(Math.abs(saldo)).padStart(13, '0')}`;
  return [
    fecha,
    detalle.padEnd(40),
    c,
    a,
    s,
    '00000000000',
    '0000000000',
    '0000000000',
    sucursal.padEnd(15),
  ].join(';');
}

/** Cuenta con línea de crédito: parte en $0, se sobregira y vuelve a $0. */
const FILAS = [
  fila('01/10/2026', 'APP-TRASPASO A:Luis Perez', 500000, 0, -500000),
  fila('01/10/2026', 'PAGO:PEAJE NUEVO ANGOS', 3800, 0, -503800, 'OF. CENTRO'),
  fila('02/10/2026', 'TRANSFERENCIA DESDE LINEA DE CREDI', 0, 103800, -400000),
  fila('02/10/2026', 'PAGO:PROVEEDORES 0333333333', 0, 357000, -43000),
  fila('03/10/2026', 'TRASPASO DE:COMERCIAL E IMPORTADOR', 0, 43000, 0),
];

const texto = (filas = FILAS, titulo = TITULO) =>
  [titulo, ENCABEZADO, ...filas].join('\r\n') + '\r\n';
const buffer = (t = texto()) => Buffer.from(t, 'utf-8');

async function cartola(nombre: string, datos: Buffer): Promise<CartolaLeida> {
  const r = await leerArchivo(nombre, datos);
  if (r.clase !== 'cartola') throw new Error('se esperaba una cartola');
  return r.cartola;
}

describe('Banco de Chile (texto)', () => {
  it('lee la cabecera, los movimientos y deduce el saldo inicial y final', async () => {
    const c = await cartola('CartolaEmitida.xls', buffer());
    expect(c).toMatchObject({
      banco: 'banco_chile',
      lector: 'bancochile_texto',
      rutEmpresa: '22222222-2',
      numeroCuenta: '123456789', // sin los ceros de la izquierda
      nCartola: null,
      desde: '2026-10-01',
      hasta: '2026-10-03',
      saldoInicial: 0,
      saldoFinal: 0,
      advertencias: [],
    });
    expect(c.movimientos).toHaveLength(5);
    expect(c.movimientos[0]).toMatchObject({
      fecha: '2026-10-01',
      orden: 1,
      monto: -500000,
      saldo: -500000,
      glosa: 'APP-TRASPASO A:Luis Perez',
      nOperacion: null, // "Docto. Nro." viene en cero
      sucursal: 'INTERNET',
      contraparteTexto: 'Luis Perez',
      rutContraparte: null,
    });
    expect(c.movimientos[2]).toMatchObject({
      monto: 103800,
      contraparteTexto: null,
    }); // línea de crédito
  });

  it('acepta el saldo negativo de una cuenta con línea de crédito', async () => {
    const c = await cartola('c.xls', buffer());
    expect(
      c.movimientos.filter((m) => (m.saldo ?? 0) < 0).length,
    ).toBeGreaterThan(0);
  });

  it('saca el RUT escondido en "PAGO:PROVEEDORES" (cero + cuerpo + dígito verificador)', async () => {
    const c = await cartola('c.xls', buffer());
    expect(c.movimientos[3]).toMatchObject({
      contraparteTexto: null,
      rutContraparte: '33333333-3',
    });
  });

  it('detecta el formato por el contenido, no por la extensión', async () => {
    for (const nombre of [
      'CartolaEmitida.xls',
      'cartola.txt',
      'cartola.csv',
      'sin_extension',
    ]) {
      expect((await cartola(nombre, buffer())).banco).toBe('banco_chile');
    }
  });

  it('lee archivos en Windows-1252 y con BOM', async () => {
    const conEne = texto([
      fila('01/10/2026', 'PAGO:NUÑEZ HNOS', 1000, 0, -1000),
    ]);
    const latin1 = await cartola('c.xls', Buffer.from(conEne, 'latin1'));
    expect(latin1.movimientos[0].glosa).toBe('PAGO:NUÑEZ HNOS');
    const conBom = await cartola('c.xls', Buffer.from('﻿' + conEne, 'utf-8'));
    expect(conBom.numeroCuenta).toBe('123456789');
  });

  it('rechaza una cartola cuyo saldo corrido no cuadra (archivo editado)', async () => {
    const mal = [...FILAS];
    mal[2] = fila(
      '02/10/2026',
      'TRANSFERENCIA DESDE LINEA DE CREDI',
      0,
      103801,
      -400000,
    );
    await expect(cartola('c.xls', buffer(texto(mal)))).rejects.toThrow(
      /saldo no cuadra/,
    );
  });

  it('da vuelta una cartola ordenada del más nuevo al más antiguo', async () => {
    const c = await cartola('c.xls', buffer(texto([...FILAS].reverse())));
    expect(c.movimientos.map((m) => m.orden)).toEqual([1, 2, 3, 4, 5]);
    expect(c.movimientos[0].fecha).toBe('2026-10-01');
    expect(c).toMatchObject({ saldoInicial: 0, saldoFinal: 0 });
  });

  it('rechaza un cargo y un abono en la misma fila', async () => {
    const mal = [fila('01/10/2026', 'RARO', 100, 100, 0)];
    await expect(cartola('c.xls', buffer(texto(mal)))).rejects.toThrow(
      /cargo y abono a la vez/,
    );
  });

  it('avisa si el RUT de la cabecera no es válido, pero lee la cartola', async () => {
    const c = await cartola(
      'c.xls',
      buffer(texto(FILAS, 'Empresa(022222222-1) cta:000123456789')),
    );
    expect(c.rutEmpresa).toBeNull();
    expect(c.advertencias.join(' ')).toMatch(/no es válido/);
  });

  it('pide la cabecera con el número de cuenta', async () => {
    await expect(
      cartola('c.xls', buffer(texto(FILAS, 'Encabezado sin cuenta'))),
    ).rejects.toThrow(/RUT y el número de cuenta/);
  });

  it('rechaza una cartola sin movimientos', async () => {
    await expect(cartola('c.xls', buffer(texto([])))).rejects.toThrow(
      /no trae movimientos/,
    );
  });
});

describe('Banco de Chile (Excel)', () => {
  async function xlsx(
    filasDatos: (string | number | Date)[][],
    titulo = TITULO,
  ) {
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Cartola');
    hoja.addRow([titulo]);
    hoja.addRow([]);
    hoja.addRow(ENCABEZADO.split(';'));
    filasDatos.forEach((f) => hoja.addRow(f));
    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  it('lee las mismas columnas en un xlsx, con números reales y fechas', async () => {
    const datos = await xlsx([
      [
        '01/10/2026',
        'APP-TRASPASO A:Luis Perez',
        500000,
        0,
        -500000,
        0,
        0,
        0,
        'INTERNET',
      ],
      [
        new Date(Date.UTC(2026, 9, 2)),
        'TRASPASO DE:COMERCIAL E IMPORTADOR',
        0,
        500000,
        0,
        0,
        0,
        0,
        'INTERNET',
      ],
      ['', 'TOTALES', '', '', '', '', '', '', ''],
    ]);
    const c = await cartola('cartola.xlsx', datos);
    expect(c).toMatchObject({
      banco: 'banco_chile',
      lector: 'bancochile_xlsx',
      numeroCuenta: '123456789',
      rutEmpresa: '22222222-2',
      saldoInicial: 0,
      saldoFinal: 0,
      desde: '2026-10-01',
      hasta: '2026-10-02',
    });
    expect(c.movimientos.map((m) => m.monto)).toEqual([-500000, 500000]);
    expect(c.movimientos[1].contraparteTexto).toBe('COMERCIAL E IMPORTADOR');
  });

  it('el mismo número de cuenta en texto y en Excel es la misma cuenta', async () => {
    const t = await cartola('c.xls', buffer());
    const x = await cartola(
      'c.xlsx',
      await xlsx(
        [
          [
            '01/10/2026',
            'GIRO CAJERO AUTOMATICO',
            1000,
            0,
            -1000,
            0,
            0,
            0,
            'CENTRAL',
          ],
        ],
        'Otra(022222222-2) cta:00-012-34567-89',
      ),
    );
    expect(x.numeroCuenta).toBe(t.numeroCuenta);
  });
});

describe('formatos que no se pueden leer', () => {
  it('avisa qué hacer con un PDF, un .xls binario y una página web', async () => {
    await expect(
      leerArchivo('c.pdf', Buffer.from('%PDF-1.7 ...')),
    ).rejects.toThrow(/PDF/);
    const ole2 = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ]);
    await expect(leerArchivo('c.xls', ole2)).rejects.toThrow(
      /\.xls binario.*\.xlsx/,
    );
    await expect(
      leerArchivo(
        'c.xls',
        Buffer.from('<html><body><table><tr><td>x</td></tr></table>'),
      ),
    ).rejects.toThrow(/página web/);
  });

  it('un texto cualquiera sigue siendo "formato no reconocido"', async () => {
    await expect(
      leerArchivo('notas.txt', Buffer.from('hola\nmundo\n')),
    ).rejects.toThrow(/Formato no reconocido/);
  });
});

describe('extraerContraparte (Banco de Chile)', () => {
  it.each([
    ['APP-TRASPASO A:Luis Perez            ', 'Luis Perez', null],
    ['TRASPASO DE:COMERCIAL E IMPORTADOR', 'COMERCIAL E IMPORTADOR', null],
    ['APP-TRASPASO DE:COMERCIAL E IMPORT', 'COMERCIAL E IMPORT', null],
    ['TRASPASO A:Jt Automatizacion', 'Jt Automatizacion', null],
    ['PAGO:PRONTO COPEC CHIM', 'PRONTO COPEC CHIM', null],
    ['PAGO:PROVEEDORES 0333333333', null, '33333333-3'],
    ['PAGO:PROVEEDORES 0333333331', null, null], // dígito verificador inválido: no se inventa un RUT
    ['TRANSFERENCIA DESDE LINEA DE CREDI', null, null],
    ['AMORTIZACION A LINEA DE CREDITO', null, null],
    ['GIRO CAJERO AUTOMATICO', null, null],
    ['COMISION MENSUAL PLAN CTACTE PYME', null, null],
  ])('%s', (glosa, texto, rut) => {
    expect(extraerContraparte(glosa)).toEqual({ texto, rut });
  });
});
