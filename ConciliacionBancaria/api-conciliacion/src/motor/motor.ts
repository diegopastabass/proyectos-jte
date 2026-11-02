/**
 * Motor de sugerencias: función pura (sin BD). Recibe movimientos pendientes, documentos con saldo,
 * contrapartes, alias aprendidos y reglas, y devuelve una propuesta (con score 0..1) por movimiento.
 *
 * Cómo decide, en orden:
 *  1. Reglas del usuario (score 1).
 *  2. Identificar la contraparte: RUT en la glosa > alias aprendido > parecido del nombre.
 *     - Si la contraparte se concilia por categoría (COPEC, la propia empresa, el dueño) → esa categoría.
 *     - Si no, sus documentos: monto exacto, o una combinación de 2 a 6 documentos que sume el monto.
 *  3. Sin nombre ni RUT en la glosa (depósitos): solo por monto exacto, con score bajo.
 *     Si la glosa trae un nombre que no se reconoce, NO se propone nada por monto: una
 *     transferencia a una persona por $25.000 no es la factura COPEC de $25.000.
 *
 * Los documentos se reparten entre movimientos sin pasarse del saldo (los de mayor score primero,
 * y a igualdad, el movimiento más antiguo paga el documento más antiguo).
 */
import { normalizarTexto } from '../common/texto';
import { IndiceNombres, patronAlias, redondear } from './similitud';

export const UMBRAL_AUTOMATICO = 0.9;
/** Bajo esto no se muestra nada. Entre ambos umbrales queda como sugerencia para revisar. */
export const UMBRAL_SUGERENCIA = 0.4;
const DIAS_ANTES = 180; // un documento puede pagarse hasta ~6 meses después de emitido
const DIAS_DESPUES = 7; // o unos días antes (anticipos, emisión atrasada)
/** Con la contraparte identificada se acepta una factura emitida hasta un mes después del pago. */
const DIAS_DESPUES_IDENTIFICADA = 31;
const SIMILITUD_MINIMA = 0.6;
/** Con una palabra que solo tiene esa contraparte basta menos parecido (nombre del banco ≠ del SII). */
const SIMILITUD_MINIMA_DISTINTIVA = 0.4;
const MARGEN_UNICO = 0.15; // el mejor nombre debe superar al segundo por este margen
const MAX_ALTERNATIVAS = 5;

export type Nivel = 'regla' | 'rut' | 'alias' | 'nombre' | 'monto';

export interface MovimientoMotor {
  id: number;
  cuentaId: number;
  fecha: string;
  monto: number; // con signo
  disponible: number; // |monto| − ya conciliado
  glosaNormalizada: string;
  contraparteTexto: string | null;
  rutContraparte: string | null;
}

export interface DocumentoMotor {
  id: number;
  direccion: 'emitido' | 'recibido';
  tipoDte: number;
  folio: number;
  rut: string;
  razonSocial: string;
  contraparteId: number | null;
  fechaEmision: string;
  saldo: number;
}

export interface ContraparteMotor {
  id: number;
  rut: string | null;
  nombre: string;
  tipo:
    | 'cliente'
    | 'proveedor'
    | 'cliente_proveedor'
    | 'propia'
    | 'persona'
    | 'otro';
  categoriaId: number | null;
}

export interface CondicionRegla {
  glosaContiene?: string;
  signo?: 'abono' | 'cargo';
  montoMin?: number;
  montoMax?: number;
  cuentaId?: number;
}

export type AccionRegla = { categoriaId: number } | { ignorar: true };

export interface ReglaMotor {
  id: number;
  nombre: string;
  prioridad: number;
  condicion: CondicionRegla;
  accion: AccionRegla;
}

export interface EntradaMotor {
  movimientos: MovimientoMotor[];
  documentos: DocumentoMotor[];
  contrapartes: ContraparteMotor[];
  alias: { patron: string; contraparteId: number; veces: number }[];
  reglas: ReglaMotor[];
  categorias: { id: number; nombre: string }[];
  /** Firmas de propuestas que el usuario ya rechazó, por movimiento. */
  rechazadas?: Map<number, Set<string>>;
}

export interface LineaPropuesta {
  movimientoId: number;
  documentoId?: number;
  categoriaId?: number;
  monto: number;
}

export interface Opcion {
  lineas: LineaPropuesta[];
  score: number;
  motivo: string;
  firma: string;
}

export interface Propuesta extends Opcion {
  movimientoId: number;
  nivel: Nivel;
  /** Regla que ignora el movimiento (no se concilia: se marca como ignorado). */
  ignorar?: boolean;
  alternativas: Opcion[];
}

interface Identificacion {
  ids: number[];
  confianza: number;
  /** Confianza distinta por contraparte (alias aprendido dentro de un grupo ambiguo). */
  confianzaPorContraparte?: Map<number, number>;
  nivel: 'rut' | 'alias' | 'nombre';
  detalle: string;
}

export function proponer(entrada: EntradaMotor): Propuesta[] {
  const ctx = new Contexto(entrada);
  const saldos = new Map(entrada.documentos.map((d) => [d.id, d.saldo]));
  const resultado = new Map<number, Propuesta>();

  let pendientes = [...entrada.movimientos].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id,
  );
  for (let ronda = 0; ronda < 4 && pendientes.length > 0; ronda++) {
    const propuestas = pendientes
      .map((m) => ctx.proponerMovimiento(m, saldos, ronda))
      .filter((p): p is Propuesta => p !== null)
      .sort(
        (a, b) =>
          b.score - a.score ||
          ctx.fecha(a.movimientoId).localeCompare(ctx.fecha(b.movimientoId)),
      );

    const reintentar: MovimientoMotor[] = [];
    for (const p of propuestas) {
      if (cabeEnSaldos(p.lineas, saldos)) {
        for (const l of p.lineas)
          if (l.documentoId)
            saldos.set(l.documentoId, saldos.get(l.documentoId)! - l.monto);
        resultado.set(p.movimientoId, p);
      } else {
        reintentar.push(ctx.movimiento(p.movimientoId));
      }
    }
    pendientes = reintentar;
  }

  // Las alternativas que usan documentos ya tomados por otro movimiento no sirven.
  for (const p of resultado.values()) {
    p.alternativas = p.alternativas.filter((a) =>
      cabeEnSaldos(a.lineas, saldos),
    );
  }
  return [...resultado.values()];
}

class Contexto {
  private readonly movimientos: Map<number, MovimientoMotor>;
  private readonly contrapartes: Map<number, ContraparteMotor>;
  private readonly porRut: Map<string, ContraparteMotor>;
  private readonly alias: Map<
    string,
    { contraparteId: number; veces: number }[]
  >;
  private readonly categorias: Map<number, string>;
  private readonly indice: IndiceNombres;
  private readonly reglas: ReglaMotor[];

  constructor(private readonly e: EntradaMotor) {
    this.movimientos = new Map(e.movimientos.map((m) => [m.id, m]));
    this.contrapartes = new Map(e.contrapartes.map((c) => [c.id, c]));
    this.porRut = new Map(
      e.contrapartes.filter((c) => c.rut).map((c) => [c.rut!, c]),
    );
    this.alias = new Map();
    for (const a of e.alias) {
      const lista = this.alias.get(a.patron) ?? [];
      lista.push(a);
      this.alias.set(a.patron, lista);
    }
    this.categorias = new Map(e.categorias.map((c) => [c.id, c.nombre]));
    this.indice = new IndiceNombres(e.contrapartes);
    this.reglas = [...e.reglas].sort(
      (a, b) => a.prioridad - b.prioridad || a.id - b.id,
    );
  }

  movimiento(id: number) {
    return this.movimientos.get(id)!;
  }

  fecha(movimientoId: number) {
    return this.movimientos.get(movimientoId)!.fecha;
  }

  proponerMovimiento(
    m: MovimientoMotor,
    saldos: Map<number, number>,
    ronda: number,
  ): Propuesta | null {
    if (m.disponible <= 0) return null;
    const rechazadas = this.e.rechazadas?.get(m.id);
    /** Un documento ya rechazado para este movimiento no compite: así el que queda sube de score. */
    const rechazado = (documentoId: number) =>
      !!rechazadas?.has(firma([{ documentoId, monto: m.disponible }]));

    const regla = this.reglas.find((r) => cumpleRegla(r.condicion, m));
    if (regla) {
      if ('ignorar' in regla.accion) {
        return {
          ...this.opcion(m, [], 1, `Regla "${regla.nombre}": ignorar`),
          movimientoId: m.id,
          nivel: 'regla',
          ignorar: true,
          alternativas: [],
        };
      }
      const cat = regla.accion.categoriaId;
      return {
        ...this.opcion(
          m,
          [{ categoriaId: cat }],
          1,
          `Regla "${regla.nombre}" → ${this.categorias.get(cat) ?? 'categoría'}`,
        ),
        movimientoId: m.id,
        nivel: 'regla',
        alternativas: [],
      };
    }

    const ident = this.identificar(m);
    let nivel: Nivel;
    let opciones: Opcion[];
    if (ident === 'desconocida') return null;
    if (ident === null) {
      nivel = 'monto';
      opciones = this.porMontoSolo(m, saldos, rechazado);
    } else {
      nivel = ident.nivel;
      opciones = this.porContraparte(m, ident, saldos, rechazado);
    }

    // Un movimiento que perdió su documento frente a otro y se reasignó en una ronda posterior
    // queda como sugerencia: hubo competencia y conviene que lo mire una persona.
    if (ronda > 0)
      opciones = opciones.map((o) => ({
        ...o,
        score: redondear(o.score * 0.85),
      }));

    opciones = opciones.filter((o) => !rechazadas?.has(o.firma));
    // Las alternativas no se filtran por score: sirven para que el usuario elija entre candidatos parejos.
    if (opciones.length === 0 || opciones[0].score < UMBRAL_SUGERENCIA)
      return null;
    const [principal, ...resto] = opciones;
    return {
      ...principal,
      movimientoId: m.id,
      nivel,
      alternativas: resto.slice(0, MAX_ALTERNATIVAS),
    };
  }

  /** null: la glosa no trae nombre ni RUT. 'desconocida': trae, pero no se reconoce. */
  private identificar(
    m: MovimientoMotor,
  ): Identificacion | null | 'desconocida' {
    const compatible = (c: ContraparteMotor) =>
      m.monto > 0 ? c.tipo !== 'proveedor' : c.tipo !== 'cliente';

    if (m.rutContraparte) {
      const c = this.porRut.get(m.rutContraparte);
      if (c)
        return {
          ids: [c.id],
          confianza: 1,
          nivel: 'rut',
          detalle: `RUT ${c.rut} (${c.nombre})`,
        };
    }

    const porNombre = this.porNombre(m, compatible);

    // Lo aprendido: un nombre de glosa, o un RUT que paga por otro (administración de un condominio).
    const patron = patronAlias(m.contraparteTexto, m.rutContraparte);
    const aprendidos = (patron ? (this.alias.get(patron) ?? []) : []).filter(
      (a) => {
        const c = this.contrapartes.get(a.contraparteId);
        return c && compatible(c);
      },
    );
    if (aprendidos.length === 0) return porNombre;

    const nombres = aprendidos
      .map((a) => this.contrapartes.get(a.contraparteId)!.nombre)
      .join(', ');
    // Texto que se parece a varias contrapartes ("COMITE DE AGUA P" lo usan 17 comités): lo aprendido
    // solo da prioridad dentro del grupo, no lo reemplaza, y nunca alcanza para conciliar solo.
    if (
      typeof porNombre === 'object' &&
      porNombre !== null &&
      porNombre.ids.length > 1
    ) {
      const confianzas = new Map(
        porNombre.ids.map((id) => [id, porNombre.confianza]),
      );
      for (const a of aprendidos) {
        confianzas.set(
          a.contraparteId,
          Math.max(
            confianzas.get(a.contraparteId) ?? 0,
            a.veces >= 2 ? 0.9 : 0.8,
          ),
        );
      }
      return {
        ids: [...confianzas.keys()],
        confianza: porNombre.confianza,
        confianzaPorContraparte: confianzas,
        nivel: 'alias',
        detalle: `${porNombre.detalle}; antes se concilió con ${nombres}`,
      };
    }
    if (aprendidos.length === 1) {
      const a = aprendidos[0];
      return {
        ids: [a.contraparteId],
        confianza: a.veces >= 2 ? 0.98 : 0.92,
        nivel: 'alias',
        detalle: `"${patron}" ya se concilió ${a.veces === 1 ? 'una vez' : `${a.veces} veces`} con ${nombres}`,
      };
    }
    return {
      ids: aprendidos.map((a) => a.contraparteId),
      confianza: 0.7,
      nivel: 'alias',
      detalle: `"${patron}" se ha conciliado con ${aprendidos.length} contrapartes distintas`,
    };
  }

  /** Contraparte por parecido del nombre en la glosa. */
  private porNombre(
    m: MovimientoMotor,
    compatible: (c: ContraparteMotor) => boolean,
  ): Identificacion | null | 'desconocida' {
    // RUT de alguien que no es cliente ni proveedor, sin nombre: se trata como si no trajera nada
    // (solo por monto). Si el usuario lo confirma, queda aprendido como alias.
    if (!m.contraparteTexto) return null;

    const ids = new Set(
      this.e.contrapartes.filter(compatible).map((c) => c.id),
    );
    const candidatos = this.indice
      .buscar(m.contraparteTexto, ids)
      // La propia empresa solo si la glosa es el comienzo de su razón social: "TEF A MARTINEZ ESPINA
      // EDUARDO" comparte palabras con "SERVICIOS ... EDUARDO MARTINEZ ESPINA EIRL" pero es una persona.
      .filter(
        (c) =>
          (c.similitud >= SIMILITUD_MINIMA ||
            (c.distintiva && c.similitud >= SIMILITUD_MINIMA_DISTINTIVA)) &&
          (this.contrapartes.get(c.id)!.tipo !== 'propia' || c.prefijo),
      );
    if (candidatos.length === 0) return 'desconocida';

    // Si solo un candidato coincide en una palabra exclusiva suya ("AUQUINC"), esa palabra decide.
    const distintivos = candidatos.filter((c) => c.distintiva);
    const mejor = distintivos.length === 1 ? distintivos[0] : candidatos[0];
    const grupo =
      distintivos.length === 1
        ? [mejor]
        : candidatos.filter(
            (c) => c.similitud >= mejor.similitud - MARGEN_UNICO,
          );
    const nombre = this.contrapartes.get(mejor.id)!.nombre;
    if (grupo.length === 1) {
      return {
        ids: [mejor.id],
        confianza: mejor.similitud,
        nivel: 'nombre',
        detalle: `"${m.contraparteTexto}" se parece a ${nombre} (${Math.round(mejor.similitud * 100)}%)`,
      };
    }
    return {
      ids: grupo.map((c) => c.id),
      confianza: redondear(mejor.similitud * 0.7),
      nivel: 'nombre',
      detalle: `"${m.contraparteTexto}" se parece a ${grupo.length} contrapartes`,
    };
  }

  private porContraparte(
    m: MovimientoMotor,
    ident: Identificacion,
    saldos: Map<number, number>,
    rechazado: (documentoId: number) => boolean,
  ): Opcion[] {
    const conCategoria = ident.ids.filter(
      (id) => this.contrapartes.get(id)!.categoriaId !== null,
    );
    const conDocumentos = ident.ids.filter(
      (id) => this.contrapartes.get(id)!.categoriaId === null,
    );

    const opciones: Opcion[] = [];
    if (conDocumentos.length > 0) {
      const ids = new Set(conDocumentos);
      const docs = this.documentosCompatibles(
        m,
        saldos,
        DIAS_DESPUES_IDENTIFICADA,
      ).filter((d) => d.contraparteId !== null && ids.has(d.contraparteId));
      opciones.push(...this.porDocumentos(m, docs, ident, rechazado));
    }

    // Contraparte que se concilia por categoría (COPEC → Combustible). Si el grupo trae
    // contrapartes con documentos y alguna calzó, la categoría queda como alternativa.
    const categorias = new Set(
      conCategoria.map((id) => this.contrapartes.get(id)!.categoriaId!),
    );
    if (categorias.size === 1) {
      const [cat] = categorias;
      const factor = conDocumentos.length === 0 ? 0.95 : 0.6;
      const quien =
        conCategoria.length === 1
          ? this.contrapartes.get(conCategoria[0])!.nombre
          : 'la contraparte';
      opciones.push(
        this.opcion(
          m,
          [{ categoriaId: cat }],
          ident.confianza * factor,
          `${ident.detalle}; ${quien} se concilia como "${this.categorias.get(cat) ?? 'categoría'}"`,
        ),
      );
    }
    return opciones.sort((a, b) => b.score - a.score);
  }

  private porDocumentos(
    m: MovimientoMotor,
    docs: DocumentoMotor[],
    ident: Identificacion,
    rechazado: (documentoId: number) => boolean,
  ): Opcion[] {
    const confianza = (d: DocumentoMotor) =>
      ident.confianzaPorContraparte?.get(d.contraparteId ?? 0) ??
      ident.confianza;
    const exactos = docs
      .filter((d) => d.saldo === m.disponible && !rechazado(d.id))
      .sort((a, b) => confianza(b) - confianza(a) || porFecha(a, b));
    const bonoFolio = (ds: DocumentoMotor[]) =>
      ds.some((d) => new RegExp(`\\b${d.folio}\\b`).test(m.glosaNormalizada))
        ? 0.03
        : 0;
    // Pagar antes de que exista la factura es posible pero menos probable: si dos pagos compiten
    // por la misma factura, gana el que vino después de emitirla.
    const pagoAnticipado = (ds: DocumentoMotor[]) =>
      ds.some((d) => d.fechaEmision > m.fecha) ? 0.95 : 1;

    if (exactos.length > 0) {
      const mismaContraparte =
        new Set(exactos.map((d) => d.contraparteId)).size === 1;
      const factor = exactos.length === 1 ? 0.95 : mismaContraparte ? 0.8 : 0.6;
      return exactos.map((d, i) =>
        this.opcion(
          m,
          [{ documentoId: d.id }],
          // Si son de la misma contraparte se prefiere la más antigua; si no, son igual de probables.
          confianza(d) *
            (i === 0 || !mismaContraparte ? factor : factor * 0.9) *
            pagoAnticipado([d]) +
            bonoFolio([d]),
          `${ident.detalle}; ${describir(d)} por el mismo monto` +
            (exactos.length > 1
              ? ` (hay ${exactos.length} candidatos${mismaContraparte ? ', se propone el más antiguo' : ''})`
              : ''),
        ),
      );
    }

    // Un pago que cubre varias facturas de la misma contraparte.
    const opciones: Opcion[] = [];
    const porContraparte = agrupar(docs, (d) => d.contraparteId ?? 0);
    for (const grupo of porContraparte.values()) {
      const soluciones = combinaciones(
        grupo.sort(porFecha).slice(0, 30),
        m.disponible,
      );
      soluciones.forEach((sol, i) => {
        const factor = soluciones.length === 1 ? 0.88 : i === 0 ? 0.65 : 0.6;
        opciones.push(
          this.opcion(
            m,
            sol.map((d) => ({ documentoId: d.id, monto: d.saldo })),
            confianza(sol[0]) * factor * pagoAnticipado(sol) + bonoFolio(sol),
            `${ident.detalle}; ${sol.length} documentos suman el monto: ${sol.map((d) => `folio ${d.folio}`).join(', ')}`,
          ),
        );
      });
    }
    return opciones;
  }

  /** Sin nombre ni RUT (depósitos, "DEPOSITO CON DOCUMENTOS"): solo el monto, nunca automático. */
  private porMontoSolo(
    m: MovimientoMotor,
    saldos: Map<number, number>,
    rechazado: (documentoId: number) => boolean,
  ): Opcion[] {
    const exactos = this.documentosCompatibles(m, saldos, DIAS_DESPUES)
      .filter((d) => d.saldo === m.disponible && !rechazado(d.id))
      .sort(
        (a, b) =>
          distanciaDias(a.fechaEmision, m.fecha) -
          distanciaDias(b.fechaEmision, m.fecha),
      );
    const factor = exactos.length === 1 ? 0.6 : 0.5;
    return exactos.map((d) =>
      this.opcion(
        m,
        [{ documentoId: d.id }],
        factor,
        `Sin nombre en la glosa; ${describir(d)} por el mismo monto` +
          (exactos.length > 1
            ? ` (hay ${exactos.length} documentos con ese monto)`
            : ''),
      ),
    );
  }

  /**
   * Documentos que este movimiento puede pagar/cobrar: abono ↔ venta (o nota de crédito de compra),
   * cargo ↔ compra (o nota de crédito de venta), con saldo y dentro de la ventana de fechas.
   */
  private documentosCompatibles(
    m: MovimientoMotor,
    saldos: Map<number, number>,
    diasDespues: number,
  ): DocumentoMotor[] {
    const desde = sumarDias(m.fecha, -DIAS_ANTES);
    const hasta = sumarDias(m.fecha, diasDespues);
    return this.e.documentos
      .map((d) => ({ ...d, saldo: saldos.get(d.id) ?? 0 }))
      .filter((d) => {
        const cobra = (d.direccion === 'emitido') !== (d.tipoDte === 61);
        return (
          d.saldo > 0 &&
          cobra === m.monto > 0 &&
          d.fechaEmision >= desde &&
          d.fechaEmision <= hasta
        );
      });
  }

  private opcion(
    m: MovimientoMotor,
    lineas: { documentoId?: number; categoriaId?: number; monto?: number }[],
    score: number,
    motivo: string,
  ): Opcion {
    const completas = lineas.map((l) => ({
      movimientoId: m.id,
      ...l,
      monto: l.monto ?? m.disponible,
    }));
    return {
      lineas: completas,
      score: redondear(Math.min(score, 1)),
      motivo,
      firma: firma(completas),
    };
  }
}

export function cumpleRegla(c: CondicionRegla, m: MovimientoMotor): boolean {
  const abs = Math.abs(m.monto);
  if (
    c.glosaContiene &&
    !m.glosaNormalizada.includes(normalizarTexto(c.glosaContiene))
  )
    return false;
  if (c.signo && (c.signo === 'abono') !== m.monto > 0) return false;
  if (c.montoMin !== undefined && abs < c.montoMin) return false;
  if (c.montoMax !== undefined && abs > c.montoMax) return false;
  if (c.cuentaId !== undefined && c.cuentaId !== m.cuentaId) return false;
  return true;
}

export function firma(
  lineas: { documentoId?: number; categoriaId?: number; monto: number }[],
): string {
  return lineas
    .map((l) =>
      l.documentoId
        ? `d${l.documentoId}:${l.monto}`
        : `c${l.categoriaId}:${l.monto}`,
    )
    .sort()
    .join('|');
}

/**
 * Combinaciones de 2 a `maxDocs` documentos cuyo saldo suma exactamente `objetivo`, buscando
 * primero entre los más antiguos. Se detiene al encontrar 2 (basta para saber si es ambigua).
 */
export function combinaciones<T extends { saldo: number }>(
  docs: T[],
  objetivo: number,
  maxDocs = 6,
  maxSoluciones = 2,
): T[][] {
  const soluciones: T[][] = [];
  let pasos = 0;
  const actual: T[] = [];
  const buscar = (desde: number, suma: number) => {
    if (soluciones.length >= maxSoluciones || ++pasos > 200_000) return;
    if (suma === objetivo && actual.length >= 2) {
      soluciones.push([...actual]);
      return;
    }
    if (actual.length === maxDocs) return;
    for (let i = desde; i < docs.length; i++) {
      if (suma + docs[i].saldo > objetivo) continue;
      actual.push(docs[i]);
      buscar(i + 1, suma + docs[i].saldo);
      actual.pop();
    }
  };
  buscar(0, 0);
  return soluciones;
}

function cabeEnSaldos(
  lineas: LineaPropuesta[],
  saldos: Map<number, number>,
): boolean {
  const uso = new Map<number, number>();
  for (const l of lineas)
    if (l.documentoId)
      uso.set(l.documentoId, (uso.get(l.documentoId) ?? 0) + l.monto);
  return [...uso].every(([id, monto]) => (saldos.get(id) ?? 0) >= monto);
}

const NOMBRES_TIPO: Record<number, string> = {
  33: 'factura',
  34: 'factura exenta',
  46: 'factura de compra',
  56: 'nota de débito',
  61: 'nota de crédito',
};

function describir(d: DocumentoMotor): string {
  return `${NOMBRES_TIPO[d.tipoDte] ?? `DTE ${d.tipoDte}`} ${d.folio} de ${d.razonSocial} (${d.fechaEmision})`;
}

function porFecha(a: DocumentoMotor, b: DocumentoMotor) {
  return a.fechaEmision.localeCompare(b.fechaEmision) || a.folio - b.folio;
}

function agrupar<T, K>(lista: T[], clave: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of lista) {
    const k = clave(x);
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function distanciaDias(a: string, b: string): number {
  return (
    Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
    86_400_000
  );
}
