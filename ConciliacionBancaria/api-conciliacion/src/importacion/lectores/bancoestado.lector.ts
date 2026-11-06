import { extraerRut, normalizarRut } from '../../common/rut';
import {
  fechaIso,
  normalizarTexto,
  parsearFechaDdMmAaaa,
  parsearMonto,
} from '../../common/texto';
import { filas, ValorCelda } from './excel.util';
import { validarSaldos } from './saldo.util';
import {
  ArchivoEntrada,
  CartolaLeida,
  ErrorLectura,
  LectorCartola,
  MovimientoLeido,
} from './lector.types';

/**
 * "Cartola Histórica de Chequera Electrónica" de BancoEstado empresas (xlsx).
 *
 * Hoja "Resumen": pares etiqueta (col A) / valor (col E): N° Cuenta, Fecha Inicio,
 * Fecha Final, N° Cartola, Saldo Inicial, Saldo Final, Rut Empresa...
 * Hoja "Movimientos": Fecha (dd/mm, SIN año) | Sucursal | N° Cuenta | Alias | N° Cartola |
 * N° Operación | Descripción | Cheques / Cargos | Depósitos / Abonos | Saldo.
 *
 * Particularidades observadas:
 * - Cargos llegan como número y abonos/saldo como texto "$1.234".
 * - La descripción viene truncada a ~35 caracteres; rara vez trae RUT ("TEF DE DE RUT 65095592-7").
 * - N° Operación se repite entre movimientos distintos (ej. 0001077, 0000000): no sirve como clave.
 */
export class BancoEstadoLector implements LectorCartola {
  readonly nombre = 'bancoestado_xlsx';
  readonly banco = 'bancoestado' as const;

  puedeLeer(archivo: ArchivoEntrada): boolean {
    const libro = archivo.libro;
    if (!libro) return false;
    const resumen = libro.getWorksheet('Resumen');
    const movimientos = libro.getWorksheet('Movimientos');
    if (!resumen || !movimientos) return false;
    const etiquetas = leerResumen(filas(resumen));
    const encabezado = (filas(movimientos)[0] ?? []).map((v) =>
      normalizarTexto(String(v ?? '')),
    );
    return (
      etiquetas.has('N CUENTA') &&
      etiquetas.has('FECHA INICIO') &&
      encabezado.includes('DEPOSITOS ABONOS')
    );
  }

  leer(archivo: ArchivoEntrada): CartolaLeida {
    const libro = archivo.libro!;
    const advertencias: string[] = [];
    const resumen = leerResumen(filas(libro.getWorksheet('Resumen')!));

    const requerido = (etiqueta: string) => {
      const v = resumen.get(etiqueta);
      if (!v) throw new ErrorLectura(`La hoja Resumen no trae "${etiqueta}"`);
      return v;
    };

    const numeroCuenta = requerido('N CUENTA').replace(/\D/g, '');
    const desde = parsearFechaDdMmAaaa(requerido('FECHA INICIO'));
    const hasta = parsearFechaDdMmAaaa(requerido('FECHA FINAL'));
    const saldoInicial = resumen.has('SALDO INICIAL')
      ? parsearMonto(resumen.get('SALDO INICIAL'))
      : null;
    const saldoFinal = resumen.has('SALDO FINAL')
      ? parsearMonto(resumen.get('SALDO FINAL'))
      : null;
    const nCartolaTexto = resumen.get('N CARTOLA');
    const nCartola =
      nCartolaTexto && /^\d+$/.test(nCartolaTexto)
        ? Number(nCartolaTexto)
        : null;
    const nMovimientos = resumen.get('N MOVIMIENTOS');
    const rutEmpresa = normalizarRut(resumen.get('RUT EMPRESA'));

    const [encabezado, ...datos] = filas(libro.getWorksheet('Movimientos')!);
    const col = indiceColumnas(encabezado, {
      fecha: 'FECHA',
      sucursal: 'SUCURSAL',
      operacion: 'N OPERACION',
      descripcion: 'DESCRIPCION',
      cargos: 'CHEQUES CARGOS',
      abonos: 'DEPOSITOS ABONOS',
      saldo: 'SALDO',
    });

    const movimientos: MovimientoLeido[] = [];
    datos.forEach((fila, i) => {
      const nFila = i + 2;
      if (fila.every((v) => v === null || v === '')) return;
      try {
        const cargo = parsearMonto(fila[col.cargos]);
        const abono = parsearMonto(fila[col.abonos]);
        if (cargo !== 0 && abono !== 0)
          throw new Error('trae cargo y abono a la vez');
        const monto = abono - cargo;
        const glosa = String(fila[col.descripcion] ?? '').trim();
        if (monto === 0) {
          advertencias.push(
            `Fila ${nFila}: movimiento en $0 omitido ("${glosa}")`,
          );
          return;
        }
        const contraparte = extraerContraparte(glosa);
        movimientos.push({
          fecha: fechaConAnio(fila[col.fecha], desde, hasta),
          orden: movimientos.length + 1,
          monto,
          saldo:
            fila[col.saldo] === null ? null : parsearMonto(fila[col.saldo]),
          glosa,
          nOperacion: textoONulo(fila[col.operacion]),
          sucursal: textoONulo(fila[col.sucursal]),
          contraparteTexto: contraparte.texto,
          rutContraparte: contraparte.rut,
        });
      } catch (e) {
        throw new ErrorLectura(
          `Hoja Movimientos, fila ${nFila}: ${(e as Error).message}`,
        );
      }
    });

    validarSaldos(movimientos, saldoInicial, saldoFinal);
    if (nMovimientos && Number(nMovimientos) !== movimientos.length) {
      advertencias.push(
        `El resumen informa ${nMovimientos} movimientos y se leyeron ${movimientos.length}`,
      );
    }

    return {
      banco: this.banco,
      lector: this.nombre,
      rutEmpresa,
      numeroCuenta,
      aliasCuenta: resumen.get('ALIAS') ?? null,
      desde,
      hasta,
      nCartola,
      saldoInicial,
      saldoFinal,
      movimientos,
      advertencias,
    };
  }
}

function leerResumen(datos: ValorCelda[][]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const fila of datos) {
    const etiqueta = normalizarTexto(String(fila[0] ?? ''));
    const valor = fila[4];
    if (etiqueta && valor !== null && valor !== undefined)
      mapa.set(etiqueta, String(valor).trim());
  }
  return mapa;
}

function indiceColumnas<T extends Record<string, string>>(
  encabezado: ValorCelda[] | undefined,
  buscadas: T,
): Record<keyof T, number> {
  const normalizado = (encabezado ?? []).map((v) =>
    normalizarTexto(String(v ?? '')),
  );
  const resultado = {} as Record<keyof T, number>;
  for (const [clave, nombre] of Object.entries(buscadas)) {
    const i = normalizado.indexOf(nombre);
    if (i < 0)
      throw new ErrorLectura(
        `La hoja Movimientos no tiene la columna "${nombre}"`,
      );
    resultado[clave as keyof T] = i;
  }
  return resultado;
}

/** La cartola trae "dd/mm"; el año sale del rango Fecha Inicio – Fecha Final. */
export function fechaConAnio(
  valor: ValorCelda,
  desde: string,
  hasta: string,
): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = String(valor ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return parsearFechaDdMmAaaa(texto);
  const m = /^(\d{2})\/(\d{2})$/.exec(texto);
  if (!m) throw new Error(`fecha inválida "${texto}"`);
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anioDesde = Number(desde.slice(0, 4));
  const anioHasta = Number(hasta.slice(0, 4));
  for (const anio of new Set([anioDesde, anioHasta])) {
    const fecha = fechaIso(anio, mes, dia);
    if (fecha >= desde && fecha <= hasta) return fecha;
  }
  throw new Error(
    `la fecha ${texto} queda fuera del período ${desde} – ${hasta}`,
  );
}

/**
 * Nombre de la contraparte en transferencias:
 * "TEF A COPEC S A", "TEF DE COMITE DE AGUA...", "TEF BANCOESTADO DE ...", "TEF DE DE RUT 65095592-7".
 */
export function extraerContraparte(glosa: string): {
  texto: string | null;
  rut: string | null;
} {
  const rut = extraerRut(glosa);
  const m = /^TEF (?:BANCOESTADO )?(?:A|DE) (.+)$/.exec(normalizarTexto(glosa));
  if (!m) return { texto: null, rut };
  const texto = m[1].startsWith('DE RUT ') ? null : m[1];
  return { texto, rut };
}

function textoONulo(v: ValorCelda): string | null {
  const t = v === null ? '' : String(v).trim();
  return t === '' ? null : t;
}
