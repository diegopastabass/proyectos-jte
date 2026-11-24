/**
 * Traduce lo que devuelve Emisso a las mismas estructuras que producen los lectores de archivos
 * (RcvLeido y CartolaLeida), para que la importación, el motor y los saldos no cambien.
 * Son funciones puras: los contratos están en https://connect.emisso.ai/docs/openapi.json.
 */
import { normalizarRut } from '../common/rut';
import { normalizarTexto, parsearFechaDdMmAaaa } from '../common/texto';
import { extraerContraparte as contraparteBancoChile } from '../importacion/lectores/bancochile.lector';
import { extraerContraparte as contraparteBancoEstado } from '../importacion/lectores/bancoestado.lector';
import type {
  Banco,
  CartolaLeida,
  DocumentoLeido,
  MovimientoLeido,
  RcvLeido,
} from '../importacion/lectores/lector.types';

// ------------------------------------------------------------------ SII

/** Fila de `sii.rcv.consultar` (solo los campos que se usan). */
export interface DocumentoRcvEmisso {
  tipoDte: number;
  folio: string;
  rutEmisor: string;
  rutReceptor: string;
  razonSocial: string;
  fechaEmision: string; // DD/MM/AAAA
  fechaEmisionDate: string | null; // AAAA-MM-DD
  montoExento: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  estado: string; // registro | pendiente | no_incluir | reclamado
  fechaRecepcion: string | null; // AAAA-MM-DD
  tipoDocRef: number | null;
  folioDocRef: string | null;
}

export interface SincronizacionRcv {
  sincronizadoEn: string;
  completo: boolean | null;
  incompletos: number | null;
}

/** Igual que el lector del CSV: RECLAMADO y NO_INCLUIR no son deuda real. */
const ESTADOS_COMPRA_ACEPTADOS = ['registro', 'pendiente'];

/**
 * Un período y una perspectiva del RCV. Devuelve null si Emisso todavía no cargó ese mes
 * (`sincronizacion: null`): una lista vacía en ese caso no significa "sin documentos".
 */
export function rcvDesdeEmisso(
  documentos: DocumentoRcvEmisso[],
  sincronizacion: SincronizacionRcv | null,
  perspectiva: 'ventas' | 'compras',
  periodo: string, // AAAA-MM
): RcvLeido | null {
  if (!sincronizacion) return null;
  const compras = perspectiva === 'compras';
  const advertencias: string[] = [];
  if (sincronizacion.completo !== true)
    advertencias.push(
      `Emisso no terminó de cargar el RCV de ${perspectiva} de ${periodo}` +
        (sincronizacion.incompletos
          ? ` (${sincronizacion.incompletos} casillas pendientes)`
          : '') +
        ': puede faltar algún documento',
    );

  const leidos: DocumentoLeido[] = [];
  const ruts = new Set<string>();
  let omitidos = 0;
  let pendientes = 0;
  for (const d of documentos) {
    if (compras && !ESTADOS_COMPRA_ACEPTADOS.includes(d.estado)) {
      omitidos++;
      continue;
    }
    const rutContraparte = normalizarRut(compras ? d.rutEmisor : d.rutReceptor);
    const rutPropio = normalizarRut(compras ? d.rutReceptor : d.rutEmisor);
    const folio = Number(d.folio);
    const fechaEmision =
      d.fechaEmisionDate ?? fechaDesdeDdMmAaaa(d.fechaEmision);
    if (!rutContraparte || !Number.isSafeInteger(folio) || !fechaEmision) {
      advertencias.push(
        `Documento omitido por datos inválidos: tipo ${d.tipoDte}, folio ${d.folio}`,
      );
      continue;
    }
    if (rutPropio) ruts.add(rutPropio);
    if (d.estado === 'pendiente') pendientes++;
    const refFolio = d.folioDocRef === null ? null : Number(d.folioDocRef);
    leidos.push({
      tipoDte: d.tipoDte,
      folio,
      rutContraparte,
      razonSocial: d.razonSocial.trim(),
      fechaEmision,
      fechaRecepcion: d.fechaRecepcion ? `${d.fechaRecepcion} 00:00:00` : null,
      montoExento: d.montoExento,
      montoNeto: d.montoNeto,
      montoIva: d.montoIva,
      montoTotal: d.montoTotal,
      refTipoDte: d.tipoDocRef,
      refFolio:
        refFolio !== null && Number.isSafeInteger(refFolio) ? refFolio : null,
    });
  }
  if (omitidos)
    advertencias.push(
      `${omitidos} documentos reclamados o «no incluir» no se importaron`,
    );
  if (pendientes)
    advertencias.push(
      `${pendientes} documentos están PENDIENTES de acuse en el SII: pueden terminar reclamados`,
    );
  if (ruts.size > 1)
    advertencias.push(
      `El RCV trae documentos de varias empresas: ${[...ruts].join(', ')}`,
    );

  const [anio, mes] = periodo.split('-').map(Number);
  return {
    tipo: compras ? 'rcv_compra' : 'rcv_venta',
    lector: 'emisso_rcv',
    rutEmpresa: ruts.size === 1 ? [...ruts][0] : null,
    periodo: `${anio}${String(mes).padStart(2, '0')}`,
    desde: `${periodo}-01`,
    hasta: ultimoDia(anio, mes),
    documentos: leidos,
    advertencias,
  };
}

// ------------------------------------------------------------------ Bancos

interface Contraparte {
  name: string | null;
  rut: string | null;
}

/** Fila de `banco_estado.movimientos.consultar`. */
export interface MovimientoBancoEstado {
  numeroCuenta: string;
  fecha: string | null;
  descripcion: string | null;
  documento: string | null;
  monto: number | null;
  type: 'debit' | 'credit' | null;
  saldo: number | null;
  oficina: string | null;
  estado: 'provisorio' | 'definitivo';
  counterparty: Contraparte | null;
}

/** Fila de `bch_empresas.movimientos.consultar`. */
export interface MovimientoBancoChile {
  id: string;
  numeroCuenta: string;
  currency: string;
  fechaMovimiento: string | null;
  fechaContable: string | null;
  monto: number | null;
  type: 'debit' | 'credit' | null;
  saldoContable: number | null;
  descripcion: string | null;
  canal: string | null;
  idTransaccion: string | null;
  counterparty: Contraparte | null;
}

/** Movimiento ya normalizado, antes de agruparlo por cuenta. */
interface Fila {
  numeroCuenta: string;
  fecha: string;
  monto: number;
  saldo: number | null;
  glosa: string;
  nOperacion: string | null;
  sucursal: string | null;
  contraparte: Contraparte | null;
  idExterno: string | null;
}

/**
 * Movimientos de BancoEstado → una CartolaLeida por cuenta. Llegan del más reciente al más
 * antiguo y solo deben venir los definitivos (los provisorios el banco los reemplaza en el
 * cierre nocturno). BancoEstado no entrega un id por movimiento.
 */
export function cartolasDesdeBancoEstado(
  movimientos: MovimientoBancoEstado[],
): CartolaLeida[] {
  const advertencias: string[] = [];
  const filas: Fila[] = [];
  for (const m of movimientos) {
    if (m.estado !== 'definitivo') continue;
    const monto = montoConSigno(m.monto, m.type);
    if (!m.fecha || monto === null) {
      advertencias.push(
        `Movimiento omitido sin fecha o monto: ${m.descripcion ?? '(sin glosa)'}`,
      );
      continue;
    }
    filas.push({
      numeroCuenta: digitosCuenta(m.numeroCuenta) || m.numeroCuenta,
      fecha: m.fecha,
      monto,
      saldo: m.saldo,
      glosa: glosa(m.descripcion),
      nOperacion: vacioANull(m.documento),
      sucursal: vacioANull(m.oficina),
      contraparte: m.counterparty,
      idExterno: null,
    });
  }
  return agruparPorCuenta(
    'bancoestado',
    'emisso_banco_estado',
    filas,
    advertencias,
    contraparteBancoEstado,
  );
}

/**
 * Movimientos de Banco de Chile → una CartolaLeida por cuenta en pesos. El banco entrega un id
 * por movimiento, que es su identidad. La fecha es la contable, la misma de la cartola.
 */
export function cartolasDesdeBancoChile(
  movimientos: MovimientoBancoChile[],
): CartolaLeida[] {
  const advertencias: string[] = [];
  const filas: Fila[] = [];
  let otrasMonedas = 0;
  for (const m of movimientos) {
    if (m.currency !== 'CLP') {
      otrasMonedas++;
      continue;
    }
    const fecha = m.fechaContable ?? m.fechaMovimiento?.slice(0, 10) ?? null;
    const monto = montoConSigno(m.monto, m.type);
    if (!fecha || monto === null) {
      advertencias.push(
        `Movimiento omitido sin fecha o monto: ${m.descripcion ?? m.id}`,
      );
      continue;
    }
    filas.push({
      numeroCuenta: digitosCuenta(m.numeroCuenta) || m.numeroCuenta,
      fecha,
      monto,
      saldo: m.saldoContable,
      glosa: glosa(m.descripcion),
      nOperacion: vacioANull(m.idTransaccion),
      sucursal: vacioANull(m.canal),
      contraparte: m.counterparty,
      idExterno: m.id,
    });
  }
  if (otrasMonedas)
    advertencias.push(
      `${otrasMonedas} movimientos en otras monedas no se importaron (solo pesos)`,
    );
  return agruparPorCuenta(
    'banco_chile',
    'emisso_bch_empresas',
    filas,
    advertencias,
    contraparteBancoChile,
  );
}

/**
 * `type` es el eje del LIBRO DEL BANCO, al revés de la cartola: 'debit' es plata que entra
 * (abono, +) y 'credit' la que sale (cargo, −). `monto` viene sin signo.
 */
export function montoConSigno(
  monto: number | null,
  type: 'debit' | 'credit' | null,
): number | null {
  if (monto === null || !type || !Number.isFinite(monto) || monto === 0)
    return null;
  const abs = Math.round(Math.abs(monto));
  return type === 'debit' ? abs : -abs;
}

function agruparPorCuenta(
  banco: Banco,
  lector: string,
  filas: Fila[],
  advertencias: string[],
  /** El mismo extractor de los archivos, para cuando Emisso no pudo leer la contraparte. */
  extraer: (glosa: string) => { texto: string | null; rut: string | null },
): CartolaLeida[] {
  const porCuenta = new Map<string, Fila[]>();
  for (const f of filas)
    porCuenta.set(f.numeroCuenta, [
      ...(porCuenta.get(f.numeroCuenta) ?? []),
      f,
    ]);

  return [...porCuenta].map(([numeroCuenta, deCuenta]) => {
    // Vienen del más reciente al más antiguo: se dan vuelta para numerar como la cartola.
    const ordenadas = [...deCuenta]
      .reverse()
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const repeticiones = new Map<string, number>();
    const movimientos: MovimientoLeido[] = ordenadas.map((f, i) => {
      // Sin id del banco, la identidad es el contenido sin el saldo (que el banco puede
      // recalcular) más la n-ésima repetición idéntica del día: dos pagos iguales el mismo
      // día son dos movimientos, y releer el mes no los duplica.
      const base = [
        f.fecha,
        f.monto,
        f.nOperacion ?? '',
        normalizarTexto(f.glosa),
      ].join('|');
      const n = (repeticiones.get(base) ?? 0) + 1;
      repeticiones.set(base, n);
      const deGlosa = extraer(f.glosa);
      return {
        fecha: f.fecha,
        orden: i + 1,
        monto: f.monto,
        saldo: f.saldo,
        glosa: f.glosa,
        nOperacion: f.nOperacion,
        sucursal: f.sucursal,
        contraparteTexto:
          vacioANull(f.contraparte?.name ?? null) ?? deGlosa.texto,
        rutContraparte: normalizarRut(f.contraparte?.rut) ?? deGlosa.rut,
        idExterno: f.idExterno,
        claveDedup: f.idExterno ? `id|${f.idExterno}` : `${base}|${n}`,
      };
    });
    return {
      banco,
      lector,
      rutEmpresa: null,
      numeroCuenta,
      aliasCuenta: null,
      desde: movimientos[0].fecha,
      hasta: movimientos[movimientos.length - 1].fecha,
      // Cada lectura se traslapa con la anterior: la continuidad por saldos no aplica.
      nCartola: null,
      saldoInicial: null,
      saldoFinal: null,
      movimientos,
      advertencias,
    };
  });
}

/** Dígitos sin ceros a la izquierda, para comparar números de cuenta escritos distinto. */
export function digitosCuenta(numero: string): string {
  return numero.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * ¿El número que entrega Emisso es la misma cuenta que la guardada? Iguales en dígitos, o uno
 * termina con el otro (Emisso antepone el código de producto en Banco de Chile).
 */
export function mismaCuenta(guardada: string, deEmisso: string): boolean {
  const a = digitosCuenta(guardada);
  const b = digitosCuenta(deEmisso);
  if (!a || !b) return false;
  if (a === b) return true;
  const [corto, largo] = a.length < b.length ? [a, b] : [b, a];
  return corto.length >= 6 && largo.endsWith(corto);
}

// ------------------------------------------------------------------ Fechas

/** "2026-11" → ["2026-10", "2026-11"]: el mes anterior se relee por los documentos atrasados. */
export function periodosALeer(hoy: Date): string[] {
  const chile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
  }).format(hoy); // "2026-11"
  const [anio, mes] = chile.split('-').map(Number);
  const anterior =
    mes === 1
      ? `${anio - 1}-12`
      : `${anio}-${String(mes - 1).padStart(2, '0')}`;
  return [anterior, chile];
}

function ultimoDia(anio: number, mes: number): string {
  const dia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${dia}`;
}

function fechaDesdeDdMmAaaa(texto: string): string | null {
  try {
    return parsearFechaDdMmAaaa(texto);
  } catch {
    return null;
  }
}

function glosa(texto: string | null): string {
  return texto?.trim() || '(sin glosa)';
}

function vacioANull(texto: string | null): string | null {
  return texto?.trim() || null;
}

// ------------------------------------------------------------ Conexiones

/** Lo que se usa de una conexión de `GET /v1/connections`. */
export interface ConexionCandidata {
  id: string;
  connector: string;
  display_name: string | null;
  empresa_rut: string | null;
}

/**
 * Conexión ya creada en Emisso para esta fuente y esta empresa, aunque no venga del enlace de la
 * app (por ejemplo, creada a mano en el panel de connect.emisso.ai). Se reconoce por el conector y
 * el RUT; si Emisso no informa RUT, por el nombre que pone la app (`<rut> <razón social>`).
 * `ocupadas` son las conexiones ya asociadas a otra empresa: nunca se adoptan.
 */
export function conexionDeEmpresa<T extends ConexionCandidata>(
  conexiones: T[],
  conector: string,
  rutEmpresa: string,
  ocupadas: ReadonlySet<string> = new Set(),
): T | null {
  const rut = normalizarRut(rutEmpresa) ?? rutEmpresa;
  const delConector = conexiones.filter(
    (c) => c.connector === conector && !ocupadas.has(c.id),
  );
  return (
    delConector.find((c) => normalizarRut(c.empresa_rut) === rut) ??
    delConector.find(
      (c) =>
        !c.empresa_rut &&
        normalizarRut(c.display_name?.split(/\s+/)[0] ?? null) === rut,
    ) ??
    null
  );
}
