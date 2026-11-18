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
          `se esperaba ${saldo} y la cartola dice ${m.saldo}. ` +
          'Puede faltar algún movimiento (descargue la cartola completa del período) o el archivo fue editado.',
      );
    }
  }
  if (saldoFinal !== null && saldo !== saldoFinal) {
    throw new ErrorLectura(
      `El saldo final calculado (${saldo}) no coincide con el del resumen (${saldoFinal})`,
    );
  }
}

/** Tope de intentos por día: un día normal se resuelve en tantos pasos como filas tiene. */
const LIMITE_PASOS = 200_000;

/**
 * Ordena las filas de un día para que cada una parta del saldo en que terminó la anterior.
 * Es una búsqueda con retroceso: el saldo puede pasar varias veces por el mismo valor en el día
 * (ej. vuelve a $0), y entonces hay más de una fila posible en ese punto. Prefiere el orden del archivo.
 */
function encadenarDia(
  filas: MovimientoLeido[],
  desde: number,
  pasos: { n: number },
): MovimientoLeido[] | null {
  const usada = filas.map(() => false);
  const orden: MovimientoLeido[] = [];
  const seguir = (actual: number): boolean => {
    if (orden.length === filas.length) return true;
    if (++pasos.n > LIMITE_PASOS) return false;
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      if (usada[i] || f.saldo! - f.monto !== actual) continue;
      usada[i] = true;
      orden.push(f);
      if (seguir(f.saldo!)) return true;
      usada[i] = false;
      orden.pop();
    }
    return false;
  };
  return seguir(desde) ? orden : null;
}

/**
 * Reordena los movimientos para que el saldo corrido encadene.
 *
 * Los bancos no ordenan siempre igual: hay cartolas con los días del más nuevo al más antiguo y el
 * día en curso en otro sentido, o cada día de arriba hacia abajo. Como cada fila informa el saldo
 * posterior a ella, el orden dentro del día importa. Aquí los días se ordenan de menor a mayor y,
 * dentro de cada día, se sigue la cadena "saldo anterior + monto = saldo". Devuelve null si falta
 * algún saldo o si algún día no se puede encadenar; el que llama debe volver a validar el resultado
 * con `validarSaldos`.
 *
 * `saldoInicial` es el saldo antes del primer día. Si no se conoce, se prueba como inicio el saldo
 * anterior de cada fila del primer día y se queda con el que deja encadenar toda la cartola: hay
 * días que terminan en el mismo saldo en que empezaron (amortizaciones que compensan un giro), y
 * ahí partir por la fila equivocada también encadena el día, pero rompe el siguiente.
 */
export function ordenarPorSaldo(
  movs: MovimientoLeido[],
  saldoInicial: number | null = null,
): MovimientoLeido[] | null {
  if (movs.length === 0 || movs.some((m) => m.saldo === null)) return null;

  // Orden aproximado: si el archivo viene del más nuevo al más antiguo, se da vuelta. Dentro de cada
  // día solo sirve de preferencia para desempatar; lo que manda es la cadena de saldos.
  const descendente = movs[0].fecha > movs[movs.length - 1].fecha;
  const base = descendente ? [...movs].reverse() : movs;
  const dias = new Map<string, MovimientoLeido[]>();
  for (const m of base) dias.set(m.fecha, [...(dias.get(m.fecha) ?? []), m]);
  const fechas = [...dias.keys()].sort();

  const pasos = { n: 0 };
  const desde = (inicio: number): MovimientoLeido[] | null => {
    const resultado: MovimientoLeido[] = [];
    let actual = inicio;
    for (const fecha of fechas) {
      const orden = encadenarDia(dias.get(fecha)!, actual, pasos);
      if (!orden) return null;
      resultado.push(...orden);
      actual = orden[orden.length - 1].saldo!;
    }
    return resultado;
  };

  let inicios: number[];
  if (saldoInicial !== null) {
    inicios = [saldoInicial];
  } else {
    const primerDia = dias.get(fechas[0])!;
    const saldos = new Set(primerDia.map((m) => m.saldo));
    const previos = primerDia.map((m) => m.saldo! - m.monto);
    inicios = [
      ...new Set([...previos.filter((p) => !saldos.has(p)), ...previos]),
    ];
  }
  for (const inicio of inicios) {
    const resultado = desde(inicio);
    if (resultado) return resultado.map((m, i) => ({ ...m, orden: i + 1 }));
  }
  return null;
}
