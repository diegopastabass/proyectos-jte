import {
  calcularVpd,
  clasificar,
  detectarEpisodios,
  fueraDesde,
  Lectura,
  resumirDias,
  UmbralesZona,
} from './analisis';
import { inicioDiaChile } from './fechas';

const u: UmbralesZona = {
  t: { zona: 'frio', variable: 't', min: 0, max: 5, alerta: true },
  hr: { zona: 'frio', variable: 'hr', min: 80, max: null, alerta: false },
  vpd: { zona: 'frio', variable: 'vpd', min: null, max: null, alerta: false },
};

const MIN = 60000;
const lectura = (ms: number, t: number | null, hr: number | null = 90): Lectura => ({
  ms,
  t,
  hr,
  vpd: calcularVpd(t, hr),
});

describe('calcularVpd', () => {
  it('coincide con la tabla de Tetens', () => {
    expect(calcularVpd(25, 50)).toBeCloseTo(1.58, 2);
    expect(calcularVpd(20, 100)).toBe(0);
    expect(calcularVpd(null, 50)).toBeNull();
  });
});

describe('clasificar', () => {
  it('distingue bajo, alto, cerca y ok', () => {
    expect(clasificar(-1, u.t, 1)).toBe('bajo');
    expect(clasificar(6, u.t, 1)).toBe('alto');
    expect(clasificar(4.5, u.t, 1)).toBe('cerca');
    expect(clasificar(2.5, u.t, 1)).toBe('ok');
    expect(clasificar(85, u.hr, 3)).toBe('ok');
    expect(clasificar(1, u.vpd, 0.1)).toBe('sin_rango');
    expect(clasificar(null, u.t, 1)).toBe('sin_dato');
  });
});

describe('inicioDiaChile', () => {
  it('da las 00:00 de Chile en horario de verano e invierno', () => {
    expect(new Date(inicioDiaChile('2026-11-18')).toISOString()).toBe('2026-11-18T03:00:00.000Z');
    expect(new Date(inicioDiaChile('2026-07-01')).toISOString()).toBe('2026-07-01T04:00:00.000Z');
  });
});

describe('resumirDias', () => {
  const dia = '2026-11-18';
  const ini = inicioDiaChile(dia);
  const fin = ini + 1440 * MIN;

  it('reparte el día entre en rango, fuera y sin datos con la duración real', () => {
    // 00:00-02:00 en rango (cada 2 min), 02:00-03:00 fuera, luego nada.
    const l: Lectura[] = [];
    for (let m = 0; m < 120; m += 2) l.push(lectura(ini + m * MIN, 3));
    for (let m = 120; m < 180; m += 2) l.push(lectura(ini + m * MIN, 8));
    const [r] = resumirDias(l, [dia], u, 10, fin);
    expect(r.minutos.ok).toBe(120);
    // La última lectura vale 2 min hasta el tope de 10: 58 + 10.
    expect(r.minutos.fuera).toBe(68);
    expect(r.minutos.sin_datos).toBe(1440 - 120 - 68);
    expect(r.fueraMin.t).toBe(68);
    expect(r.t).toEqual({ min: 3, max: 8, prom: 4.67 });
  });

  it('cuenta el día en curso solo hasta ahora', () => {
    const [r] = resumirDias([lectura(ini, 3)], [dia], u, 10, ini + 60 * MIN);
    expect(r.minutos.ok).toBe(10);
    expect(r.minutos.sin_datos).toBe(50);
  });
});

describe('detectarEpisodios', () => {
  const ini = inicioDiaChile('2026-11-18');

  it('une episodios cercanos, descarta lecturas aisladas y marca el que sigue en curso', () => {
    const valores = [3, 7, 3, 3, 3, 8, 8, 8, 3, 8, 8, 8, 8];
    const l = valores.map((v, i) => lectura(ini + i * 2 * MIN, v));
    const eps = detectarEpisodios(l, u, 10, ini + 26 * MIN);
    // La lectura aislada de las 00:02 (2 min) se descarta; 00:10-00:16 y 00:18-en curso se unen.
    expect(eps).toHaveLength(1);
    expect(eps[0]).toMatchObject({ variable: 't', tipo: 'alto', extremo: 8, enCurso: true });
    expect(eps[0].inicio).toBe(ini + 10 * MIN);
  });

  it('cierra el episodio en un hueco mayor que el tope', () => {
    const l = [lectura(ini, 8), lectura(ini + 2 * MIN, 8), lectura(ini + 60 * MIN, 3)];
    const [e] = detectarEpisodios(l, u, 10, ini + 70 * MIN);
    expect(e.fin).toBe(ini + 12 * MIN);
    expect(e.enCurso).toBe(false);
  });
});

describe('fueraDesde', () => {
  it('devuelve el inicio del tramo fuera de rango actual', () => {
    const ini = inicioDiaChile('2026-11-18');
    const l = [3, 3, 8, 8, 8].map((v, i) => lectura(ini + i * 2 * MIN, v));
    expect(fueraDesde(l, u, 10)).toBe(ini + 4 * MIN);
    expect(fueraDesde(l.slice(0, 2), u, 10)).toBeNull();
  });
});
