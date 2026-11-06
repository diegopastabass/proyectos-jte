import { ErrorLectura, type MovimientoLeido } from './lector.types';

/**
 * Comprueba que el saldo corrido de la cartola cuadre al peso: cada fila debe ser el saldo anterior
 * más su monto. Si no cuadra, el archivo fue editado o cambió el formato del banco, y se rechaza
 * antes de guardar nada. Sin saldo inicial no hay contra qué comparar.
 */
export function validarSaldos(
  movs: MovimientoLeido[],
  saldoInicial: number | null,
  saldoFinal: number | null,
) {
  if (saldoInicial === null) return;
  let saldo = saldoInicial;
  for (const m of movs) {
    saldo += m.monto;
    if (m.saldo !== null && m.saldo !== saldo) {
      throw new ErrorLectura(
        `El saldo no cuadra en el movimiento ${m.orden} (${m.fecha} "${m.glosa}"): ` +
          `se esperaba ${saldo} y la cartola dice ${m.saldo}. ¿El archivo fue editado?`,
      );
    }
  }
  if (saldoFinal !== null && saldo !== saldoFinal) {
    throw new ErrorLectura(
      `El saldo final calculado (${saldo}) no coincide con el del resumen (${saldoFinal})`,
    );
  }
}
