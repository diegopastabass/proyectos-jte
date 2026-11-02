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
