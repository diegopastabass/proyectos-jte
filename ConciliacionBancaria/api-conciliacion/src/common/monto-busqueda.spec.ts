import { montoDeBusqueda, porCercaniaDeMonto } from './monto-busqueda';

describe('montoDeBusqueda', () => {
  it.each([
    ['5500CLP', 5500],
    ['5500 clp', 5500],
    ['$5.500', 5500],
    ['$ 1.250.000', 1250000],
    ['$5500', 5500],
    ['1.000.000CLP', 1000000],
  ])('%s → %i', (texto, monto) => {
    expect(montoDeBusqueda(texto)).toBe(monto);
  });

  it.each([
    '5500',
    '12345',
    'COPEC 5500CLP',
    '$',
    'CLP',
    '',
    '  ',
    '5.5CLP',
    'abc',
  ])('"%s" no es un monto', (texto) => {
    expect(montoDeBusqueda(texto)).toBeNull();
  });

  it('tolera null y undefined', () => {
    expect(montoDeBusqueda(null)).toBeNull();
    expect(montoDeBusqueda(undefined)).toBeNull();
  });
});

describe('porCercaniaDeMonto', () => {
  it('acota a ±1000 sobre el valor absoluto', () => {
    const { donde, distancia } = porCercaniaDeMonto('m.monto', ':monto');
    expect(distancia).toBe('ABS(ABS(m.monto) - :monto)');
    expect(donde).toBe('ABS(ABS(m.monto) - :monto) <= 1000');
  });
});

/** El ejemplo del requerimiento: se ordena por cercanía a 5500 con margen de 1000. */
describe('orden por cercanía', () => {
  it('ordena los movimientos del ejemplo', () => {
    const movs = [
      { mov: 2, monto: 5000 },
      { mov: 13, monto: 5490 },
      { mov: 15, monto: 6450 },
      { mov: 22, monto: -4990 },
      { mov: 40, monto: 7000 },
    ];
    const buscado = montoDeBusqueda('5500CLP')!;
    const orden = movs
      .map((m) => ({ ...m, d: Math.abs(Math.abs(m.monto) - buscado) }))
      .filter((m) => m.d <= 1000)
      .sort((a, b) => a.d - b.d)
      .map((m) => m.mov);
    expect(orden).toEqual([13, 2, 22, 15]);
  });
});
