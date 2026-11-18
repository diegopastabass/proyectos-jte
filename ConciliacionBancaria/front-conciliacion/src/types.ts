// Tipos de las respuestas de api-conciliacion.

export type Rol = "admin" | "operador" | "lector";

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  esAdmin: boolean;
}

export interface LoginRespuesta {
  access_token: string;
  usuario: Usuario;
}

export interface Empresa {
  id: number;
  rut: string;
  razonSocial: string;
  rol: Rol;
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  items: T[];
}

export type EstadoMovimiento = "pendiente" | "parcial" | "conciliado" | "ignorado";
export type EstadoDocumento = "pendiente" | "parcial" | "pagado" | "anulado" | "excluido";
export type Direccion = "emitido" | "recibido";

export interface CuentaBancaria {
  id: number;
  banco: "bancoestado" | "banco_chile";
  numero: string;
  alias: string | null;
  activa: boolean;
}

export interface Movimiento {
  id: number;
  cuentaId: number;
  fecha: string;
  monto: number;
  saldo: number | null;
  glosa: string;
  nOperacion: string | null;
  contraparteTexto: string | null;
  rutContraparte: string | null;
  ignorado: boolean;
  montoConciliado: number;
  estado: EstadoMovimiento;
  nota: string | null;
  proyectoId: number | null;
  /** Solo en el listado. */
  nComprobantes?: number;
}

export type TipoComprobante = "boleta" | "factura" | "otro";

export interface Comprobante {
  id: number;
  tipo: TipoComprobante;
  fecha: string | null;
  montoTotal: number;
  montoIva: number;
  rutEmisor: string | null;
  razonSocial: string | null;
  folio: string | null;
  descripcion: string | null;
  archivoId: string;
  conciliacionId: number | null;
  creadoEn: string;
}

export interface LineaMovimiento {
  id: number;
  conciliacionId: number;
  montoAplicado: number;
  origen: "auto" | "regla" | "manual";
  creadoEn: string;
  documentoId: number | null;
  tipoDte: number | null;
  folio: number | null;
  razonSocial: string | null;
  montoTotal: number | null;
  categoriaId: number | null;
  categoria: string | null;
}

export interface MovimientoDetalle extends Movimiento {
  lineas: LineaMovimiento[];
  comprobantes: Comprobante[];
}

export interface Documento {
  id: number;
  direccion: Direccion;
  tipoDte: number;
  folio: number;
  rutContraparte: string;
  razonSocial: string;
  contraparteId: number | null;
  fechaEmision: string;
  montoNeto: number;
  montoIva: number;
  montoExento: number;
  montoTotal: number;
  refTipoDte: number | null;
  refFolio: number | null;
  saldoPendiente: number;
  estado: EstadoDocumento;
  proyectoId: number | null;
}

export interface DocumentoDetalle extends Documento {
  tipoNombre: string | null;
  pagos: {
    id: number;
    conciliacionId: number;
    montoAplicado: number;
    origen: string;
    movimientoId: number;
    fecha: string;
    glosa: string;
    monto: number;
  }[];
  notasCredito: {
    id: number;
    monto: number;
    origen: string;
    notaCreditoId: number;
    documentoId: number;
    tipoDte: number;
    folio: number;
  }[];
}

export interface Candidato {
  id: number;
  direccion: Direccion;
  tipoDte: number;
  folio: number;
  rut: string;
  razonSocial: string;
  fechaEmision: string;
  montoTotal: number;
  saldoPendiente: number;
  estado: EstadoDocumento;
  similitud: number;
  montoCalza: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  tipo: "ingreso" | "gasto" | "traspaso" | "retiro" | "impuesto" | "otro";
  activa: boolean;
}

export type TipoContraparte =
  | "cliente"
  | "proveedor"
  | "cliente_proveedor"
  | "propia"
  | "persona"
  | "otro";

export interface Contraparte {
  id: number;
  rut: string | null;
  nombre: string;
  tipo: TipoContraparte;
  categoriaId: number | null;
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

export interface Sugerencia extends Opcion {
  id: number;
  movimientoId: number;
  nivel: string;
  alternativas: Opcion[];
  estado: "pendiente" | "aceptada" | "rechazada" | "obsoleta";
  movimiento: {
    id: number;
    cuentaId: number;
    fecha: string;
    monto: number;
    montoConciliado: number;
    glosa: string;
    estado: EstadoMovimiento;
  } | null;
}

export interface DocumentoResumido {
  id: number;
  direccion: Direccion;
  tipoDte: number;
  folio: number;
  razonSocial: string;
  rut: string;
  fechaEmision: string;
  montoTotal: number;
  saldoPendiente: number;
  estado: EstadoDocumento;
}

export interface PaginaSugerencias extends Pagina<Sugerencia> {
  documentos: Record<number, DocumentoResumido>;
  categorias: Record<number, { id: number; nombre: string; tipo: string }>;
}

export interface ResumenMotor {
  movimientosEvaluados: number;
  conciliadosAutomaticamente: number;
  ignoradosPorRegla: number;
  sugerencias: number;
  sinPropuesta: number;
}

export interface Importacion {
  id: number;
  tipo: "cartola" | "rcv_compra" | "rcv_venta";
  archivoNombre: string;
  periodoDesde: string | null;
  periodoHasta: string | null;
  nCartola: number | null;
  filasLeidas: number;
  filasNuevas: number;
  filasDuplicadas: number;
  advertencias: string[];
  creadoEn: string;
}

export interface ResultadoImportacion {
  importacion: Importacion;
  cuentaCreada?: boolean;
  notasCreditoAplicadas?: number;
}

export interface Resumen {
  movimientos: { estado: EstadoMovimiento; cantidad: number; porConciliar: number }[];
  documentos: { direccion: Direccion; cantidad: number; saldo: number }[];
  sugerenciasPendientes: number;
  cuentas: {
    id: number;
    banco: string;
    numero: string;
    alias: string | null;
    saldo: number | null;
    hasta: string | null;
    nCartola: number | null;
  }[];
  rcv: { tipo: string; hasta: string | null }[];
}

export interface CondicionRegla {
  glosaContiene?: string;
  signo?: "abono" | "cargo";
  montoMin?: number;
  montoMax?: number;
  cuentaId?: number;
}

export interface Regla {
  id: number;
  nombre: string;
  prioridad: number;
  activa: boolean;
  condicion: CondicionRegla;
  accion: { categoriaId: number } | { ignorar: true };
}

export interface UsuarioEmpresa {
  id: number;
  email: string;
  nombre: string;
  activo: boolean;
  rol: Rol;
}

export interface UsuarioAdmin {
  id: number;
  email: string;
  nombre: string;
  esAdmin: boolean;
  activo: boolean;
}

export interface BalanceProyecto {
  ingresos: { neto: number; iva: number; total: number };
  gastos: { neto: number; ivaCredito: number; ivaBoletas: number; total: number };
  resultado: number;
  iva: { debito: number; credito: number; saldo: number };
  porCobrar: number;
  porPagar: number;
  documentos: number;
  movimientos: number;
}

export interface Proyecto {
  id: number;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  contraparteId: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  presupuesto: number | null;
  activo: boolean;
  balance: BalanceProyecto;
}

export interface ProyectoDetalle extends Proyecto {
  porCategoria: { categoriaId: number | null; nombre: string; gastos: number; ingresos: number }[];
  documentos: {
    id: number;
    direccion: Direccion;
    tipoDte: number;
    folio: number;
    rutContraparte: string;
    razonSocial: string;
    fechaEmision: string;
    montoNeto: number;
    montoIva: number;
    montoTotal: number;
    saldoPendiente: number;
    estado: EstadoDocumento;
  }[];
  movimientos: {
    id: number;
    fecha: string;
    monto: number;
    /** Parte que no se concilió con un documento (lo que cuenta en el balance). */
    sinDocumento: number;
    iva: number;
    glosa: string;
    estado: EstadoMovimiento;
    categorias: string | null;
    nComprobantes: number;
  }[];
}

export interface MontosReporte {
  cargos: number;
  abonos: number;
  movimientos: number;
}

export interface ReporteCategorias {
  meses: string[];
  categorias: (MontosReporte & {
    id: number;
    nombre: string;
    tipo: Categoria["tipo"];
    meses: Record<string, { cargos: number; abonos: number }>;
  })[];
  documentos: MontosReporte;
  porConciliar: MontosReporte;
}

export interface ReporteContraparte {
  rut: string;
  razonSocial: string;
  pagado: number;
  cobrado: number;
  documentos: number;
  movimientos: number;
}
