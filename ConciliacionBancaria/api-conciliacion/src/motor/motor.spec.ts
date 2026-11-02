/**
 * Casos sintéticos que reproducen lo visto en las cartolas reales de BancoEstado y el RCV:
 * glosas truncadas, montos repetidos entre clientes, COPEC, traspasos y retiros.
 */
import { normalizarTexto } from '../common/texto';
import { extraerContraparte } from '../importacion/lectores/bancoestado.lector';
import {
  ContraparteMotor,
  DocumentoMotor,
  EntradaMotor,
  firma,
  MovimientoMotor,
  proponer,
  combinaciones,
  UMBRAL_AUTOMATICO,
} from './motor';
import { IndiceNombres, palabrasGlosa } from './similitud';

const CAT_TRASPASO = 1;
const CAT_RETIRO = 2;
const CAT_COMBUSTIBLE = 6;
const CAT_COMISIONES = 4;

const CONTRAPARTES: ContraparteMotor[] = [
  {
    id: 1,
    rut: '22222222-2',
    nombre: 'SERVICIOS AUTOMATIZACION EDUARDO PRUEBA ESPINA EIRL',
    tipo: 'propia',
    categoriaId: CAT_TRASPASO,
  },
  {
    id: 2,
    rut: '44444444-4',
    nombre: 'COMITE DE AGUA POTABLE RURAL DE RANGUIL',
    tipo: 'cliente',
    categoriaId: null,
  },
  {
    id: 3,
    rut: '33333333-3',
    nombre: 'COMITE DE AGUA POTABLE RURAL LAS HORNILLAS',
    tipo: 'cliente',
    categoriaId: null,
  },
  {
    id: 4,
    rut: '11111112-K',
    nombre: 'COMITE DE AGUA POTABLE RURAL TRINIDAD',
    tipo: 'cliente',
    categoriaId: null,
  },
  {
    id: 5,
    rut: '55555555-5',
    nombre: 'COOPERATIVA DE SERVICIO SANITARIO RURAL AUQUINCO LTDA',
    tipo: 'cliente',
    categoriaId: null,
  },
  {
    id: 6,
    rut: '66666666-6',
    nombre: 'COOPERATIVA DE SERVICIO SANITARIO RURAL ZUNIGA LIMITADA',
    tipo: 'cliente',
    categoriaId: null,
  },
  {
    id: 7,
    rut: '77777777-7',
    nombre: 'COPEC S.A.',
    tipo: 'proveedor',
    categoriaId: CAT_COMBUSTIBLE,
  },
  {
    id: 8,
    rut: '88888888-8',
    nombre: 'MATERIALES ELECTRICOS SPA',
    tipo: 'proveedor',
    categoriaId: null,
  },
  {
    id: 9,
    rut: '99999999-9',
    nombre: 'CONDOMINIO PINARES',
    tipo: 'cliente',
    categoriaId: null,
  },
];

let siguienteId = 1;
function mov(fecha: string, monto: number, glosa: string): MovimientoMotor {
  const c = extraerContraparte(glosa);
  return {
    id: siguienteId++,
    cuentaId: 1,
    fecha,
    monto,
    disponible: Math.abs(monto),
    glosaNormalizada: normalizarTexto(glosa),
    contraparteTexto: c.texto,
    rutContraparte: c.rut,
  };
}

let siguienteDoc = 100;
function doc(
  contraparteId: number,
  folio: number,
  fecha: string,
  saldo: number,
  tipoDte = 33,
): DocumentoMotor {
  const c = CONTRAPARTES.find((x) => x.id === contraparteId)!;
  return {
    id: siguienteDoc++,
    direccion: c.tipo === 'proveedor' ? 'recibido' : 'emitido',
    tipoDte,
    folio,
    rut: c.rut!,
    razonSocial: c.nombre,
    contraparteId,
    fechaEmision: fecha,
    saldo,
  };
}

function entrada(
  movimientos: MovimientoMotor[],
  documentos: DocumentoMotor[],
  extra: Partial<EntradaMotor> = {},
): EntradaMotor {
  return {
    movimientos,
    documentos,
    contrapartes: CONTRAPARTES,
    alias: [],
    reglas: [],
    categorias: [
      { id: CAT_TRASPASO, nombre: 'Traspaso entre cuentas propias' },
      { id: CAT_RETIRO, nombre: 'Retiro del dueño' },
      { id: CAT_COMISIONES, nombre: 'Comisiones y gastos bancarios' },
      { id: CAT_COMBUSTIBLE, nombre: 'Combustible y peajes' },
    ],
    ...extra,
  };
}

const unica = (e: EntradaMotor) => {
  const r = proponer(e);
  expect(r).toHaveLength(1);
  return r[0];
};

describe('similitud de nombres', () => {
  const indice = new IndiceNombres(CONTRAPARTES);

  it('descarta la última palabra truncada a 1-2 letras', () => {
    expect(palabrasGlosa('COMITE DE AGUA P')).toEqual(['COMITE', 'AGUA']);
    expect(palabrasGlosa('COPEC S A')).toEqual(['COPEC']);
  });

  it('reconoce un nombre truncado por la palabra distintiva', () => {
    const [mejor, segundo] = indice.buscar('COMITE DE AGUA POTABLE RANGU');
    expect(mejor).toMatchObject({ id: 2, similitud: 1 });
    // Los otros comités comparten "COMITE AGUA POTABLE"; lo que decide es la ventaja de "RANGU".
    expect(mejor.similitud - segundo.similitud).toBeGreaterThan(0.15);
  });

  it('acepta abreviaturas (COOP → COOPERATIVA) y da peso a la palabra rara', () => {
    const [mejor, ...resto] = indice.buscar('COOP DE AGUA POTABLE AUQUINC');
    expect(mejor).toMatchObject({ id: 5, distintiva: true });
    expect(mejor.similitud).toBeGreaterThanOrEqual(0.4);
    expect(
      resto.every((c) => !c.distintiva && c.similitud < mejor.similitud),
    ).toBe(true);
  });

  it('marca prefijo solo cuando la glosa es el comienzo del nombre', () => {
    expect(indice.buscar('SERVICIOS AUTOMATIZACION EDUA')[0]).toMatchObject({
      id: 1,
      prefijo: true,
    });
    const persona = indice
      .buscar('PRUEBA ESPINA EDUARDO NICOL')
      .find((c) => c.id === 1);
    expect(persona?.prefijo).toBe(false);
  });
});

describe('motor', () => {
  it('cobro con nombre truncado y monto único → automático', () => {
    const m = mov('2026-10-07', 71028, 'TEF DE COMITE DE AGUA POTABLE RANGU');
    const d = doc(2, 1875, '2026-10-06', 71028);
    const p = unica(entrada([m], [d, doc(3, 1880, '2026-10-06', 50000)]));
    expect(p.lineas).toEqual([
      { movimientoId: m.id, documentoId: d.id, monto: 71028 },
    ]);
    expect(p.nivel).toBe('nombre');
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('nombre ambiguo ("COMITE DE AGUA P") con varias facturas del mismo monto → sugerencia con alternativas', () => {
    const m = mov('2026-10-07', 41650, 'TEF BANCOESTADO DE COMITE DE AGUA P');
    const docs = [
      doc(2, 1885, '2026-10-06', 41650),
      doc(3, 1887, '2026-10-06', 41650),
      doc(4, 1888, '2026-10-07', 41650),
    ];
    const p = unica(entrada([m], docs));
    expect(p.score).toBeLessThan(UMBRAL_AUTOMATICO);
    expect(p.alternativas).toHaveLength(2);
    expect(
      new Set([p, ...p.alternativas].map((o) => o.lineas[0].documentoId)),
    ).toEqual(new Set(docs.map((d) => d.id)));
  });

  it('nombre ambiguo pero una sola factura calza → sugerencia (no automática)', () => {
    const m = mov('2026-10-16', 189405, 'TEF BANCOESTADO DE COMITE DE AGUA P');
    const d = doc(4, 1900, '2026-10-10', 189405);
    const p = unica(entrada([m], [d, doc(2, 1901, '2026-10-10', 41650)]));
    expect(p.lineas[0].documentoId).toBe(d.id);
    expect(p.score).toBeLessThan(UMBRAL_AUTOMATICO);
    expect(p.score).toBeGreaterThanOrEqual(0.6);
  });

  it('COPEC se concilia como Combustible (contraparte con categoría), aunque haya facturas del monto', () => {
    const m = mov('2026-10-06', -20000, 'TEF A COPEC S A');
    const p = unica(entrada([m], [doc(7, 33125185, '2026-10-01', 20000)]));
    expect(p.lineas).toEqual([
      { movimientoId: m.id, categoriaId: CAT_COMBUSTIBLE, monto: 20000 },
    ]);
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('transferencia a la propia empresa → traspaso entre cuentas propias', () => {
    const m = mov('2026-10-08', -35000, 'TEF A SERVICIOS AUTOMATIZACION EDUA');
    const p = unica(entrada([m], []));
    expect(p.lineas[0].categoriaId).toBe(CAT_TRASPASO);
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('una persona no registrada NO calza por monto con una factura de otro (caso real: $25.000 vs COPEC)', () => {
    const sinCategoria = CONTRAPARTES.map((c) =>
      c.id === 7 ? { ...c, categoriaId: null } : c,
    );
    const m = mov('2026-09-29', -25000, 'TEF A VALENZUELA CISTERNAS NANCY YE');
    expect(
      proponer({
        ...entrada([m], [doc(7, 32535156, '2026-09-20', 25000)]),
        contrapartes: sinCategoria,
      }),
    ).toEqual([]);
  });

  it('el dueño (persona con nombre parecido a la empresa) no se toma como traspaso', () => {
    const m = mov('2026-10-07', -15000, 'TEF A PRUEBA ESPINA EDUARDO NICOL');
    expect(proponer(entrada([m], []))).toEqual([]);

    const conDueno = [
      ...CONTRAPARTES,
      {
        id: 10,
        rut: null,
        nombre: 'PRUEBA ESPINA EDUARDO NICOLAS',
        tipo: 'persona' as const,
        categoriaId: CAT_RETIRO,
      },
    ];
    const p = unica({ ...entrada([m], []), contrapartes: conDueno });
    expect(p.lineas[0].categoriaId).toBe(CAT_RETIRO);
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('la inicial truncada distingue personas con el mismo apellido (caso real "MARTINEZ ESPINA L")', () => {
    const conDueno = [
      ...CONTRAPARTES,
      {
        id: 10,
        rut: null,
        nombre: 'PRUEBA ESPINA EDUARDO NICOLAS',
        tipo: 'persona' as const,
        categoriaId: CAT_RETIRO,
      },
    ];
    const otra = mov(
      '2026-10-06',
      -264237,
      'TEF BANCOESTADO A PRUEBA ESPINA L',
    );
    expect(
      proponer({ ...entrada([otra], []), contrapartes: conDueno }),
    ).toEqual([]);
    // Y "COMITE DE AGUA P" sigue calzando con los comités (P → POTABLE).
    expect(
      new IndiceNombres(CONTRAPARTES).buscar('COMITE DE AGUA P')[0].similitud,
    ).toBe(1);
  });

  it('RUT en la glosa identifica al cliente aunque no haya nombre', () => {
    const m = mov('2026-10-13', 59500, 'TEF DE DE RUT 99999999-9');
    const d = doc(9, 1913, '2026-10-10', 59500);
    const p = unica(entrada([m], [d]));
    expect(p).toMatchObject({ nivel: 'rut', lineas: [{ documentoId: d.id }] });
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('depósito sin nombre: solo sugerencia por monto, nunca automático', () => {
    const m = mov('2026-10-15', 47250, 'DEPOSITO CON DOCUMENTOS');
    const p = unica(entrada([m], [doc(3, 1898, '2026-10-01', 47250)]));
    expect(p.nivel).toBe('monto');
    expect(p.score).toBe(0.6);
  });

  it('un pago que cubre dos facturas del mismo cliente', () => {
    const m = mov('2026-10-20', 113078, 'TEF DE COMITE DE AGUA POTABLE RANGU');
    const a = doc(2, 1874, '2026-09-06', 71028);
    const b = doc(2, 1890, '2026-10-06', 42050);
    const p = unica(entrada([m], [a, b, doc(2, 1891, '2026-10-06', 9999)]));
    expect(p.lineas).toEqual([
      { movimientoId: m.id, documentoId: a.id, monto: 71028 },
      { movimientoId: m.id, documentoId: b.id, monto: 42050 },
    ]);
    expect(p.score).toBeLessThan(UMBRAL_AUTOMATICO);
  });

  it('dos pagos iguales del mismo cliente: el más antiguo paga la factura más antigua, sin repetir documento', () => {
    const m1 = mov('2026-09-29', 71028, 'TEF DE COMITE DE AGUA POTABLE RANGU');
    const m2 = mov('2026-10-19', 71028, 'TEF DE COMITE DE AGUA POTABLE RANGU');
    const vieja = doc(2, 1800, '2026-09-01', 71028);
    const nueva = doc(2, 1905, '2026-10-01', 71028);
    const r = proponer(entrada([m2, m1], [nueva, vieja]));
    const de = (m: MovimientoMotor) =>
      r.find((p) => p.movimientoId === m.id)!.lineas[0].documentoId;
    expect(de(m1)).toBe(vieja.id);
    expect(de(m2)).toBe(nueva.id);
  });

  it('no propone documentos fuera de la ventana de fechas', () => {
    const m = mov('2026-10-07', 71028, 'TEF DE COMITE DE AGUA POTABLE RANGU');
    expect(
      proponer(
        entrada(
          [m],
          [doc(2, 1, '2025-12-01', 71028), doc(2, 2, '2026-11-15', 71028)],
        ),
      ),
    ).toEqual([]);
  });

  it('una regla del usuario gana y concilia con score 1', () => {
    const m = mov('2026-10-05', -29986, 'PAGO MOVISTAR RECARGAS');
    const p = unica(
      entrada([m], [], {
        reglas: [
          {
            id: 1,
            nombre: 'Movistar',
            prioridad: 10,
            condicion: { glosaContiene: 'movistar', signo: 'cargo' },
            accion: { categoriaId: CAT_COMISIONES },
          },
        ],
      }),
    );
    expect(p).toMatchObject({
      nivel: 'regla',
      score: 1,
      lineas: [{ categoriaId: CAT_COMISIONES, monto: 29986 }],
    });
  });

  it('en una glosa ambigua el alias aprendido prioriza a ese cliente, pero no concilia solo', () => {
    const m = mov('2026-10-21', 47350, 'TEF BANCOESTADO DE COMITE DE AGUA P');
    const d = doc(3, 1897, '2026-10-10', 47350);
    const e = entrada([m], [doc(4, 1899, '2026-10-01', 47350), d], {
      alias: [{ patron: 'COMITE DE AGUA P', contraparteId: 3, veces: 2 }],
    });
    const p = unica(e);
    expect(p).toMatchObject({
      nivel: 'alias',
      lineas: [{ documentoId: d.id }],
    });
    expect(p.score).toBeLessThan(UMBRAL_AUTOMATICO);
  });

  it('el alias de un texto ambiguo no deja sin propuesta a los otros clientes (caso real)', () => {
    // Se aprendió "COMITE DE AGUA P" → comité 3, pero esta vez paga el comité 4.
    const m = mov('2026-10-16', 189405, 'TEF BANCOESTADO DE COMITE DE AGUA P');
    const d = doc(4, 1900, '2026-10-15', 189405);
    const p = unica(
      entrada([m], [d], {
        alias: [{ patron: 'COMITE DE AGUA P', contraparteId: 3, veces: 1 }],
      }),
    );
    expect(p.lineas[0].documentoId).toBe(d.id);
  });

  it('con un nombre inequívoco el alias (2+ confirmaciones) concilia solo', () => {
    const m = mov('2026-10-21', 47350, 'TEF DE COMITE AGUA POTABLE LAS HORN');
    const d = doc(3, 1897, '2026-10-10', 47350);
    const p = unica(
      entrada([m], [d], {
        alias: [
          {
            patron: 'COMITE AGUA POTABLE LAS HORN',
            contraparteId: 3,
            veces: 2,
          },
        ],
      }),
    );
    expect(p.nivel).toBe('alias');
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('no vuelve a proponer lo que el usuario rechazó; pasa a la siguiente alternativa', () => {
    const m = mov('2026-10-07', 41650, 'TEF BANCOESTADO DE COMITE DE AGUA P');
    const docs = [
      doc(2, 1, '2026-10-01', 41650),
      doc(3, 2, '2026-10-02', 41650),
    ];
    const primera = unica(entrada([m], docs));
    const segunda = unica(
      entrada([m], docs, {
        rechazadas: new Map([[m.id, new Set([primera.firma])]]),
      }),
    );
    expect(segunda.lineas[0].documentoId).not.toBe(
      primera.lineas[0].documentoId,
    );
    expect(segunda.score).toBeGreaterThan(primera.score); // ya no compite con el rechazado
    expect(firma(segunda.lineas)).toBe(segunda.firma);
  });
});

describe('combinaciones', () => {
  it('encuentra la combinación más antigua y se detiene al ver ambigüedad', () => {
    const d = [{ saldo: 10 }, { saldo: 20 }, { saldo: 30 }, { saldo: 40 }];
    expect(combinaciones(d, 50)).toEqual([
      [{ saldo: 10 }, { saldo: 40 }],
      [{ saldo: 20 }, { saldo: 30 }],
    ]);
    expect(combinaciones(d, 1000)).toEqual([]);
  });
});

describe('nombre del banco distinto al del SII', () => {
  it('"COOP DE AGUA POTABLE AUQUINC" se sugiere (no automático) por la palabra distintiva', () => {
    const m = mov('2026-10-09', 41650, 'TEF DE COOP DE AGUA POTABLE AUQUINC');
    const d = doc(5, 1876, '2026-10-06', 41650);
    // La factura del comité es más antigua y de folio menor: si el nombre no decidiera, ganaría ella.
    const p = unica(entrada([m], [d, doc(2, 1801, '2026-10-01', 41650)]));
    expect(p.lineas[0].documentoId).toBe(d.id);
    expect(p.alternativas).toHaveLength(0);
    expect(p.score).toBeLessThan(UMBRAL_AUTOMATICO);
  });
});

describe('RUT que paga por otro y facturas posteriores al pago', () => {
  it('RUT desconocido sin nombre: sugerencia solo por monto', () => {
    const m = mov('2026-10-13', 59500, 'TEF DE DE RUT 12345670-K');
    const d = doc(9, 1913, '2026-10-10', 59500);
    expect(unica(entrada([m], [d]))).toMatchObject({
      nivel: 'monto',
      score: 0.6,
      lineas: [{ documentoId: d.id }],
    });
  });

  it('ese RUT aprendido como alias identifica al cliente', () => {
    const m = mov('2026-11-13', 59500, 'TEF DE DE RUT 12345670-K');
    const d = doc(9, 1950, '2026-11-10', 59500);
    const p = unica(
      entrada([m], [d], {
        alias: [{ patron: 'RUT 12345670-K', contraparteId: 9, veces: 2 }],
      }),
    );
    expect(p).toMatchObject({
      nivel: 'alias',
      lineas: [{ documentoId: d.id }],
    });
    expect(p.score).toBeGreaterThanOrEqual(UMBRAL_AUTOMATICO);
  });

  it('con la contraparte identificada acepta una factura emitida hasta un mes después del pago', () => {
    const m = mov('2026-10-05', 83300, 'TEF DE DE RUT 99999999-9');
    const d = doc(9, 1919, '2026-10-29', 83300);
    expect(unica(entrada([m], [d])).lineas[0].documentoId).toBe(d.id);
  });

  it('solo por monto, no (la ventana sigue siendo de 7 días)', () => {
    const m = mov('2026-10-05', 83300, 'DEPOSITO CON DOCUMENTOS');
    expect(proponer(entrada([m], [doc(9, 1919, '2026-10-29', 83300)]))).toEqual(
      [],
    );
  });
});

describe('pago anterior a la factura', () => {
  it('si dos pagos compiten por una factura, gana el que vino después de emitirla (caso real AUQUINCO)', () => {
    const septiembre = mov(
      '2026-09-25',
      41650,
      'TEF DE COOP DE AGUA POTABLE AUQUINC',
    );
    const octubre = mov(
      '2026-10-09',
      41650,
      'TEF DE COOP DE AGUA POTABLE AUQUINC',
    );
    const d = doc(5, 1876, '2026-10-06', 41650);
    const r = proponer(entrada([septiembre, octubre], [d]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      movimientoId: octubre.id,
      lineas: [{ documentoId: d.id }],
    });
  });
});
