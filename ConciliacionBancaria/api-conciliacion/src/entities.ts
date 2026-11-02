/**
 * Entidades TypeORM. Reflejan db/001_esquema.sql (synchronize: false): si se cambia el
 * esquema, se agrega un script en db/ y se ajusta aquí.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numeroDesdePg } from './common/numero.transformer';
import type {
  AccionRegla,
  CondicionRegla,
  LineaPropuesta,
  Opcion,
} from './motor/motor';

const monto = { type: 'bigint' as const, transformer: numeroDesdePg };
const idLargo = { type: 'bigint' as const, transformer: numeroDesdePg };

export type RolEmpresa = 'admin' | 'operador' | 'lector';
export type EstadoMovimiento =
  'pendiente' | 'parcial' | 'conciliado' | 'ignorado';
export type EstadoDocumento =
  'pendiente' | 'parcial' | 'pagado' | 'anulado' | 'excluido';
export type Direccion = 'emitido' | 'recibido';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn() id: number;
  @Column() email: string;
  @Column({ name: 'hash_password', select: false }) hashPassword: string;
  @Column() nombre: string;
  @Column({ name: 'es_admin' }) esAdmin: boolean;
  @Column() activo: boolean;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn() id: number;
  @Column() rut: string;
  @Column({ name: 'razon_social' }) razonSocial: string;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('usuario_empresa')
export class UsuarioEmpresa {
  @PrimaryColumn({ name: 'usuario_id' }) usuarioId: number;
  @PrimaryColumn({ name: 'empresa_id' }) empresaId: number;
  @Column() rol: RolEmpresa;
  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;
  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}

@Entity('cuenta_bancaria')
export class CuentaBancaria {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column() banco: 'bancoestado' | 'banco_chile';
  @Column() numero: string;
  @Column({ type: 'text', nullable: true }) alias: string | null;
  @Column() moneda: string;
  @Column() activa: boolean;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('contraparte')
export class Contraparte {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column({ type: 'text', nullable: true }) rut: string | null;
  @Column() nombre: string;
  @Column() tipo:
    | 'cliente'
    | 'proveedor'
    | 'cliente_proveedor'
    | 'propia'
    | 'persona'
    | 'otro';
  /** Si tiene categoría, sus movimientos se concilian contra ella y sus documentos quedan excluidos. */
  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;
}

@Entity('categoria')
export class Categoria {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column() nombre: string;
  @Column() tipo:
    'ingreso' | 'gasto' | 'traspaso' | 'retiro' | 'impuesto' | 'otro';
  @Column() activa: boolean;
}

@Entity('importacion')
export class Importacion {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column({ name: 'cuenta_id', type: 'int', nullable: true }) cuentaId:
    number | null;
  @Column() tipo: 'cartola' | 'rcv_compra' | 'rcv_venta';
  @Column() lector: string;
  @Column({ name: 'archivo_nombre' }) archivoNombre: string;
  @Column({ name: 'archivo_sha256' }) archivoSha256: string;
  @Column({ name: 'periodo_desde', type: 'date', nullable: true })
  periodoDesde: string | null;
  @Column({ name: 'periodo_hasta', type: 'date', nullable: true })
  periodoHasta: string | null;
  @Column({ name: 'n_cartola', type: 'int', nullable: true }) nCartola:
    number | null;
  @Column({ name: 'saldo_inicial', ...monto, nullable: true }) saldoInicial:
    number | null;
  @Column({ name: 'saldo_final', ...monto, nullable: true }) saldoFinal:
    number | null;
  @Column({ name: 'filas_leidas' }) filasLeidas: number;
  @Column({ name: 'filas_nuevas' }) filasNuevas: number;
  @Column({ name: 'filas_duplicadas' }) filasDuplicadas: number;
  @Column({ type: 'jsonb' }) advertencias: string[];
  @Column({ name: 'usuario_id' }) usuarioId: number;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('movimiento')
export class Movimiento {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: numeroDesdePg,
  } as never)
  id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column({ name: 'cuenta_id' }) cuentaId: number;
  @Column({ name: 'importacion_id' }) importacionId: number;
  @Column({ type: 'date' }) fecha: string;
  @Column() orden: number;
  @Column(monto) monto: number;
  @Column({ ...monto, nullable: true }) saldo: number | null;
  @Column() glosa: string;
  @Column({ name: 'glosa_normalizada' }) glosaNormalizada: string;
  @Column({ name: 'n_operacion', type: 'text', nullable: true }) nOperacion:
    string | null;
  @Column({ type: 'text', nullable: true }) sucursal: string | null;
  @Column({ name: 'contraparte_texto', type: 'text', nullable: true })
  contraparteTexto: string | null;
  @Column({ name: 'rut_contraparte', type: 'text', nullable: true })
  rutContraparte: string | null;
  @Column({ name: 'contraparte_id', type: 'int', nullable: true })
  contraparteId: number | null;
  @Column() ignorado: boolean;
  @Column({ name: 'monto_conciliado', ...monto }) montoConciliado: number;
  @Column() estado: EstadoMovimiento;
  @Column({ type: 'text', nullable: true }) nota: string | null;
  @Column({ name: 'hash_dedup', select: false }) hashDedup: string;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('documento')
export class Documento {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: numeroDesdePg,
  } as never)
  id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column({ name: 'importacion_id', type: 'int', nullable: true })
  importacionId: number | null;
  @Column() direccion: Direccion;
  @Column({ name: 'tipo_dte', type: 'smallint' }) tipoDte: number;
  @Column(idLargo) folio: number;
  @Column({ name: 'rut_contraparte' }) rutContraparte: string;
  @Column({ name: 'razon_social' }) razonSocial: string;
  @Column({ name: 'contraparte_id', type: 'int', nullable: true })
  contraparteId: number | null;
  @Column({ name: 'fecha_emision', type: 'date' }) fechaEmision: string;
  @Column({ name: 'fecha_recepcion', type: 'timestamptz', nullable: true })
  fechaRecepcion: Date | null;
  @Column({ name: 'monto_exento', ...monto }) montoExento: number;
  @Column({ name: 'monto_neto', ...monto }) montoNeto: number;
  @Column({ name: 'monto_iva', ...monto }) montoIva: number;
  @Column({ name: 'monto_total', ...monto }) montoTotal: number;
  @Column({ name: 'ref_tipo_dte', type: 'smallint', nullable: true })
  refTipoDte: number | null;
  @Column({ name: 'ref_folio', ...idLargo, nullable: true }) refFolio:
    number | null;
  @Column({ name: 'saldo_pendiente', ...monto }) saldoPendiente: number;
  @Column() estado: EstadoDocumento;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('conciliacion')
export class Conciliacion {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: numeroDesdePg,
  } as never)
  id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column() origen: 'auto' | 'regla' | 'manual';
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    nullable: true,
    transformer: numeroDesdePg,
  })
  score: number | null;
  @Column({ type: 'text', nullable: true }) nota: string | null;
  @Column({ name: 'creado_por', type: 'int', nullable: true }) creadoPor:
    number | null;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
  @Column({ name: 'deshecha_en', type: 'timestamptz', nullable: true })
  deshechaEn: Date | null;
  @Column({ name: 'deshecha_por', type: 'int', nullable: true }) deshechaPor:
    number | null;
  @OneToMany(() => ConciliacionLinea, (l) => l.conciliacion)
  lineas: ConciliacionLinea[];
}

@Entity('conciliacion_linea')
export class ConciliacionLinea {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: numeroDesdePg,
  } as never)
  id: number;
  @Column({ name: 'conciliacion_id', ...idLargo }) conciliacionId: number;
  @Column({ name: 'movimiento_id', ...idLargo }) movimientoId: number;
  @Column({ name: 'documento_id', ...idLargo, nullable: true }) documentoId:
    number | null;
  @Column({ name: 'categoria_id', type: 'int', nullable: true }) categoriaId:
    number | null;
  @Column({ name: 'monto_aplicado', ...monto }) montoAplicado: number;
  @ManyToOne(() => Conciliacion, (c) => c.lineas)
  @JoinColumn({ name: 'conciliacion_id' })
  conciliacion: Conciliacion;
}

@Entity('regla')
export class Regla {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column() nombre: string;
  @Column() prioridad: number;
  @Column() activa: boolean;
  @Column({ type: 'jsonb' }) condicion: CondicionRegla;
  @Column({ type: 'jsonb' }) accion: AccionRegla;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
}

@Entity('sugerencia')
export class Sugerencia {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: numeroDesdePg,
  } as never)
  id: number;
  @Column({ name: 'empresa_id' }) empresaId: number;
  @Column({ name: 'movimiento_id', ...idLargo }) movimientoId: number;
  @Column() nivel: string;
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    transformer: numeroDesdePg,
  })
  score: number;
  @Column() motivo: string;
  @Column({ type: 'jsonb' }) lineas: LineaPropuesta[];
  @Column({ type: 'jsonb' }) alternativas: Opcion[];
  @Column() firma: string;
  @Column() estado: 'pendiente' | 'aceptada' | 'rechazada' | 'obsoleta';
  @Column({ name: 'conciliacion_id', ...idLargo, nullable: true })
  conciliacionId: number | null;
  @Column({ name: 'creado_por', type: 'int', nullable: true }) creadoPor:
    number | null;
  @CreateDateColumn({ name: 'creado_en' }) creadoEn: Date;
  @Column({ name: 'resuelta_por', type: 'int', nullable: true }) resueltaPor:
    number | null;
  @Column({ name: 'resuelta_en', type: 'timestamptz', nullable: true })
  resueltaEn: Date | null;
}

export const ENTIDADES = [
  Usuario,
  Empresa,
  UsuarioEmpresa,
  CuentaBancaria,
  Contraparte,
  Categoria,
  Importacion,
  Movimiento,
  Documento,
  Conciliacion,
  ConciliacionLinea,
  Regla,
  Sugerencia,
];
