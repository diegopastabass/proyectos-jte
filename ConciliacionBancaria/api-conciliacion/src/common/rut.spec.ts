import { calcularDv, extraerRut, normalizarRut } from './rut';
import {
  horaChileADate,
  normalizarTexto,
  parsearFechaDdMmAaaa,
  parsearMonto,
} from './texto';

describe('rut', () => {
  it('calcula el dígito verificador, incluido K y 0', () => {
    expect(calcularDv(22222222)).toBe('2');
    expect(calcularDv(11111112)).toBe('K');
    expect(calcularDv(10000004)).toBe('0');
  });

  it('normaliza formatos con y sin puntos', () => {
    expect(normalizarRut('22.222.222-2')).toBe('22222222-2');
    expect(normalizarRut('11111112-k')).toBe('11111112-K');
    expect(normalizarRut('222222222')).toBe('22222222-2');
  });

  it('acepta ceros a la izquierda, como los escribe Banco de Chile', () => {
    expect(normalizarRut('022222222-2')).toBe('22222222-2'); // cabecera de la cartola
    expect(normalizarRut('0333333333')).toBe('33333333-3'); // "PAGO:PROVEEDORES 0…", sin guion
    expect(normalizarRut('0333333331')).toBeNull();
  });

  it('rechaza DV incorrecto y números cortos', () => {
    expect(normalizarRut('22222222-1')).toBeNull();
    expect(normalizarRut('12345')).toBeNull();
    expect(normalizarRut('')).toBeNull();
  });

  it('extrae el RUT de una glosa de BancoEstado', () => {
    expect(extraerRut('TEF DE DE RUT 33333333-3')).toBe('33333333-3');
    expect(extraerRut('TEF DE DE RUT 11111112-K')).toBe('11111112-K');
    expect(extraerRut('DEPOSITO EN EFECTIVO CRC: 007DCFF0')).toBeNull();
    // número de 8 dígitos sin DV válido: no es RUT
    expect(extraerRut('PAGO 12345678-0')).toBeNull();
  });
});

describe('texto', () => {
  it('normaliza tildes, símbolos y espacios', () => {
    expect(normalizarTexto('  Operadora de Sistemas Electrónicos SPA ')).toBe(
      'OPERADORA DE SISTEMAS ELECTRONICOS SPA',
    );
    expect(normalizarTexto('SOC. COMERCIAL ROSSEL Y ROSSEL LTDA')).toBe(
      'SOC COMERCIAL ROSSEL Y ROSSEL LTDA',
    );
  });

  it('parsea montos en los formatos de la cartola', () => {
    expect(parsearMonto('$1.042.542')).toBe(1042542);
    expect(parsearMonto(39500)).toBe(39500);
    expect(parsearMonto('$0')).toBe(0);
    expect(parsearMonto('-$5.000')).toBe(-5000);
    expect(parsearMonto('$-5.000')).toBe(-5000);
    // Banco de Chile: signo explícito y ceros a la izquierda
    expect(parsearMonto('+0000500000')).toBe(500000);
    expect(parsearMonto('-0000000500000')).toBe(-500000);
    expect(parsearMonto('00000000000')).toBe(0);
    expect(parsearMonto(null)).toBe(0);
    expect(() => parsearMonto('$12,50')).toThrow();
  });

  it('convierte hora de Chile a UTC respetando el horario de verano', () => {
    // septiembre 2026 ya es horario de verano (UTC−3); junio es invierno (UTC−4)
    expect(horaChileADate('2026-09-25 14:50:44').toISOString()).toBe(
      '2026-09-25T17:50:44.000Z',
    );
    expect(horaChileADate('2026-06-10 10:00:00').toISOString()).toBe(
      '2026-06-10T14:00:00.000Z',
    );
  });

  it('parsea fechas dd/mm/aaaa y rechaza las inexistentes', () => {
    expect(parsearFechaDdMmAaaa('25/09/2026')).toBe('2026-09-25');
    expect(parsearFechaDdMmAaaa('25/09/2026 14:50:44')).toBe('2026-09-25');
    expect(() => parsearFechaDdMmAaaa('31/02/2026')).toThrow();
  });
});
