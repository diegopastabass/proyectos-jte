/**
 * Conectores de Emisso con respuestas sintéticas que imitan el contrato de su API
 * (las respuestas reales traen datos financieros y no van al repositorio).
 */
import {
  cartolasDesdeBancoChile,
  cartolasDesdeBancoEstado,
  type DocumentoRcvEmisso,
  mismaCuenta,
  montoConSigno,
  type MovimientoBancoChile,
  type MovimientoBancoEstado,
  periodosALeer,
  rcvDesdeEmisso,
} from './conectores';

const SINC = {
  sincronizadoEn: '2026-11-20T10:00:00Z',
  completo: true,
  incompletos: 0,
};

function doc(extra: Partial<DocumentoRcvEmisso> = {}): DocumentoRcvEmisso {
  return {
    tipoDte: 33,
    folio: '1967',
    rutEmisor: '76907914-9',
    rutReceptor: '76889487-6',
    razonSocial: 'CB MANTENCION Y MONTAJE ELECTRICO SPA ',
    fechaEmision: '13/11/2026',
    fechaEmisionDate: '2026-11-13',
    montoExento: 0,
    montoNeto: 280000,
    montoIva: 53200,
    montoTotal: 333200,
    estado: 'registro',
    fechaRecepcion: '2026-11-13',
    tipoDocRef: null,
    folioDocRef: null,
    ...extra,
  };
}

describe('rcvDesdeEmisso', () => {
  it('ventas: la contraparte es el receptor y el RUT propio el emisor', () => {
    const rcv = rcvDesdeEmisso([doc()], SINC, 'ventas', '2026-11')!;
    expect(rcv.tipo).toBe('rcv_venta');
    expect(rcv.rutEmpresa).toBe('76907914-9');
    expect(rcv.periodo).toBe('202611');
    expect(rcv.desde).toBe('2026-11-01');
    expect(rcv.hasta).toBe('2026-11-30');
    expect(rcv.documentos).toEqual([
      {
        tipoDte: 33,
        folio: 1967,
        rutContraparte: '76889487-6',
        razonSocial: 'CB MANTENCION Y MONTAJE ELECTRICO SPA',
        fechaEmision: '2026-11-13',
        fechaRecepcion: '2026-11-13 00:00:00',
        montoExento: 0,
        montoNeto: 280000,
        montoIva: 53200,
        montoTotal: 333200,
        refTipoDte: null,
        refFolio: null,
      },
    ]);
    expect(rcv.advertencias).toEqual([]);
  });

  it('compras: la contraparte es el emisor y se omiten reclamados y no incluir', () => {
    const compra = (estado: string, folio: string) =>
      doc({
        estado,
        folio,
        rutEmisor: '76889487-6',
        rutReceptor: '76907914-9',
      });
    const rcv = rcvDesdeEmisso(
      [
        compra('registro', '1'),
        compra('pendiente', '2'),
        compra('reclamado', '3'),
        compra('no_incluir', '4'),
      ],
      SINC,
      'compras',
      '2026-11',
    )!;
    expect(rcv.tipo).toBe('rcv_compra');
    expect(rcv.rutEmpresa).toBe('76907914-9');
    expect(rcv.documentos.map((d) => d.folio)).toEqual([1, 2]);
    expect(rcv.documentos[0].rutContraparte).toBe('76889487-6');
    expect(rcv.advertencias).toEqual([
      '2 documentos reclamados o «no incluir» no se importaron',
      '1 documentos están PENDIENTES de acuse en el SII: pueden terminar reclamados',
    ]);
  });

  it('nota de crédito con referencia, y fecha solo en formato chileno', () => {
    const rcv = rcvDesdeEmisso(
      [
        doc({
          tipoDte: 61,
          folio: '12',
          tipoDocRef: 33,
          folioDocRef: '1967',
          fechaEmisionDate: null,
          fechaEmision: '02/12/2026',
        }),
      ],
      SINC,
      'ventas',
      '2026-12',
    )!;
    expect(rcv.documentos[0]).toMatchObject({
      tipoDte: 61,
      folio: 12,
      refTipoDte: 33,
      refFolio: 1967,
      fechaEmision: '2026-12-02',
    });
  });

  it('mes no cargado en Emisso: null, no "cero documentos"', () => {
    expect(rcvDesdeEmisso([], null, 'ventas', '2026-11')).toBeNull();
  });

  it('carga incompleta: importa lo que hay y avisa', () => {
    const rcv = rcvDesdeEmisso(
      [doc()],
      { ...SINC, completo: false, incompletos: 2 },
      'ventas',
      '2026-11',
    )!;
    expect(rcv.documentos).toHaveLength(1);
    expect(rcv.advertencias[0]).toMatch(/no terminó de cargar.*2 casillas/);
  });

  it('omite documentos con RUT o folio inválidos', () => {
    const rcv = rcvDesdeEmisso(
      [doc({ rutReceptor: '1-1' }), doc({ folio: 'abc' })],
      SINC,
      'ventas',
      '2026-11',
    )!;
    expect(rcv.documentos).toHaveLength(0);
    expect(rcv.advertencias).toHaveLength(2);
  });
});

describe('montoConSigno', () => {
  it("'debit' es plata que entra (abono) y 'credit' la que sale (cargo)", () => {
    expect(montoConSigno(333200, 'debit')).toBe(333200);
    expect(montoConSigno(119500, 'credit')).toBe(-119500);
  });
  it('sin monto, sin tipo o en cero no es un movimiento', () => {
    expect(montoConSigno(null, 'debit')).toBeNull();
    expect(montoConSigno(1000, null)).toBeNull();
    expect(montoConSigno(0, 'credit')).toBeNull();
  });
});

function movBE(
  extra: Partial<MovimientoBancoEstado> = {},
): MovimientoBancoEstado {
  return {
    numeroCuenta: '12345678901',
    fecha: '2026-11-15',
    descripcion: 'TEF DE CB MANTENCION Y MONTAJE',
    documento: '0001',
    monto: 333200,
    type: 'debit',
    saldo: 1000000,
    oficina: 'STGO.PRINCIPAL',
    estado: 'definitivo',
    counterparty: { name: 'CB MANTENCION Y MONTAJE', rut: '76889487-6' },
    ...extra,
  };
}

describe('cartolasDesdeBancoEstado', () => {
  it('mapea, ordena del más antiguo al más reciente y descarta provisorios', () => {
    // Emisso los entrega del más reciente al más antiguo.
    const [c] = cartolasDesdeBancoEstado([
      movBE({ fecha: '2026-11-20', estado: 'provisorio', monto: 5000 }),
      movBE({
        fecha: '2026-11-16',
        type: 'credit',
        monto: 119500,
        descripcion: 'PAGO PROVEEDOR',
        counterparty: null,
        documento: null,
      }),
      movBE(),
    ]);
    expect(c.banco).toBe('bancoestado');
    expect(c.lector).toBe('emisso_banco_estado');
    expect(c.numeroCuenta).toBe('12345678901');
    expect([c.desde, c.hasta]).toEqual(['2026-11-15', '2026-11-16']);
    expect(c.saldoInicial).toBeNull();
    expect(c.movimientos.map((m) => [m.orden, m.fecha, m.monto])).toEqual([
      [1, '2026-11-15', 333200],
      [2, '2026-11-16', -119500],
    ]);
    expect(c.movimientos[0]).toMatchObject({
      glosa: 'TEF DE CB MANTENCION Y MONTAJE',
      nOperacion: '0001',
      sucursal: 'STGO.PRINCIPAL',
      contraparteTexto: 'CB MANTENCION Y MONTAJE',
      rutContraparte: '76889487-6',
      idExterno: null,
    });
  });

  it('sin counterparty, la contraparte sale de la glosa como en el archivo', () => {
    const [c] = cartolasDesdeBancoEstado([
      movBE({ counterparty: null, descripcion: 'TEF DE COMITE DE AGUA P' }),
    ]);
    expect(c.movimientos[0].contraparteTexto).toBe('COMITE DE AGUA P');
  });

  it('dos pagos idénticos el mismo día son dos movimientos con claves distintas', () => {
    const [c] = cartolasDesdeBancoEstado([
      movBE({ saldo: 2000 }),
      movBE({ saldo: 1000 }),
    ]);
    const [a, b] = c.movimientos.map((m) => m.claveDedup);
    expect(a).not.toBe(b);
    expect(a).toMatch(/\|1$/);
    expect(b).toMatch(/\|2$/);
  });

  it('la clave no depende del saldo: el banco puede recalcularlo', () => {
    const [antes] = cartolasDesdeBancoEstado([movBE({ saldo: 1000000 })]);
    const [despues] = cartolasDesdeBancoEstado([movBE({ saldo: 999999 })]);
    expect(antes.movimientos[0].claveDedup).toBe(
      despues.movimientos[0].claveDedup,
    );
  });

  it('una cartola por cuenta; sin movimientos, ninguna', () => {
    expect(
      cartolasDesdeBancoEstado([movBE(), movBE({ numeroCuenta: '999' })]),
    ).toHaveLength(2);
    expect(cartolasDesdeBancoEstado([])).toEqual([]);
  });
});

function movBCH(
  extra: Partial<MovimientoBancoChile> = {},
): MovimientoBancoChile {
  return {
    id: '000123456789',
    numeroCuenta: 'CTD 1234567890',
    currency: 'CLP',
    fechaMovimiento: '2026-11-15T10:20:00-03:00',
    fechaContable: '2026-11-15',
    monto: 41650,
    type: 'debit',
    saldoContable: 500000,
    descripcion: 'TRASPASO DE:COMITE DE AGUA POTABLE',
    canal: 'INTERNET',
    idTransaccion: 'TX1',
    counterparty: { name: 'COMITE DE AGUA POTABLE RURAL', rut: '71780000-1' },
    ...extra,
  };
}

describe('cartolasDesdeBancoChile', () => {
  it('usa el id del banco como identidad y la fecha contable', () => {
    const [c] = cartolasDesdeBancoChile([
      movBCH({ fechaContable: '2026-11-16' }),
    ]);
    expect(c.banco).toBe('banco_chile');
    expect(c.movimientos[0]).toMatchObject({
      fecha: '2026-11-16',
      monto: 41650,
      saldo: 500000,
      idExterno: '000123456789',
      claveDedup: 'id|000123456789',
      nOperacion: 'TX1',
      sucursal: 'INTERNET',
      contraparteTexto: 'COMITE DE AGUA POTABLE RURAL',
      rutContraparte: '71780000-1',
    });
  });

  it('sin fecha contable usa el día de la fecha del movimiento', () => {
    const [c] = cartolasDesdeBancoChile([movBCH({ fechaContable: null })]);
    expect(c.movimientos[0].fecha).toBe('2026-11-15');
  });

  it('solo importa pesos y avisa de las otras monedas', () => {
    const [c] = cartolasDesdeBancoChile([
      movBCH(),
      movBCH({ id: '2', currency: 'USD' }),
    ]);
    expect(c.movimientos).toHaveLength(1);
    expect(c.advertencias).toEqual([
      '1 movimientos en otras monedas no se importaron (solo pesos)',
    ]);
  });
});

describe('mismaCuenta', () => {
  it.each([
    ['12345678901', '12345678901', true],
    ['1234567890', 'CTD 001234567890', true], // código de producto y ceros de relleno
    ['1234567890', '00-123-45678-90', true],
    ['12345678901', '98765432109', false],
    ['12345', '9912345', false], // muy corto para comparar por sufijo
    ['', '123', false],
  ])('%s vs %s → %s', (a, b, esperado) => {
    expect(mismaCuenta(a, b)).toBe(esperado);
  });
});

describe('periodosALeer', () => {
  it('el mes en curso de Chile y el anterior', () => {
    expect(periodosALeer(new Date('2026-11-21T12:00:00Z'))).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });
  it('en enero, diciembre del año anterior', () => {
    expect(periodosALeer(new Date('2027-01-05T12:00:00Z'))).toEqual([
      '2026-12',
      '2027-01',
    ]);
  });
  it('usa la hora de Chile, no la UTC', () => {
    // 1 de diciembre 01:00 UTC = 30 de noviembre 22:00 en Chile (verano, UTC−3).
    expect(periodosALeer(new Date('2026-12-01T01:00:00Z'))).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });
});
