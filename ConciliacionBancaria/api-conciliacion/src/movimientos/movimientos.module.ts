import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DataSource } from 'typeorm';
import {
  RolMinimo,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import { auditar, consultar, recalcular } from '../common/auditoria';
import { IndiceNombres, redondear } from '../motor/similitud';
import { Pagina, PaginacionDto } from '../common/paginacion';
import { normalizarTexto } from '../common/texto';
import { type EstadoMovimiento, Movimiento } from '../entities';

class FiltroMovimientosDto extends PaginacionDto {
  /** Atajo: pendientes + parciales. */
  @IsOptional() @IsIn(['true', 'false']) porConciliar?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() cuentaId?: number;
  @IsOptional()
  @IsIn(['pendiente', 'parcial', 'conciliado', 'ignorado'])
  estado?: EstadoMovimiento;
  @IsOptional() @IsIn(['abono', 'cargo']) signo?: 'abono' | 'cargo';
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  /** Busca en la glosa. */
  @IsOptional() @IsString() q?: string;
}

class FiltroCandidatosDto {
  /** Busca por razón social, RUT o folio, en todos los documentos con saldo (incluso excluidos). */
  @IsOptional() @IsString() q?: string;
}

export interface Candidato {
  id: number;
  direccion: string;
  tipoDte: number;
  folio: number;
  rut: string;
  razonSocial: string;
  fechaEmision: string;
  montoTotal: number;
  saldoPendiente: number;
  estado: string;
  /** Parecido entre la glosa del movimiento y la razón social (0..1). */
  similitud: number;
  /** El saldo del documento es exactamente lo que le queda al movimiento. */
  montoCalza: boolean;
}

class ActualizarMovimientoDto {
  @IsOptional() @IsBoolean() ignorado?: boolean;
  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

@Injectable()
export class MovimientosService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listar(
    empresaId: number,
    f: FiltroMovimientosDto,
  ): Promise<Pagina<Movimiento>> {
    const qb = this.ds
      .getRepository(Movimiento)
      .createQueryBuilder('m')
      .where('m.empresaId = :empresaId', { empresaId });
    if (f.cuentaId)
      qb.andWhere('m.cuentaId = :cuentaId', { cuentaId: f.cuentaId });
    if (f.estado) qb.andWhere('m.estado = :estado', { estado: f.estado });
    if (f.porConciliar === 'true')
      qb.andWhere("m.estado IN ('pendiente', 'parcial')");
    if (f.signo)
      qb.andWhere(f.signo === 'abono' ? 'm.monto > 0' : 'm.monto < 0');
    if (f.desde) qb.andWhere('m.fecha >= :desde', { desde: f.desde });
    if (f.hasta) qb.andWhere('m.fecha <= :hasta', { hasta: f.hasta });
    if (f.q)
      qb.andWhere('m.glosaNormalizada LIKE :q', {
        q: `%${normalizarTexto(f.q)}%`,
      });

    const [items, total] = await qb
      .orderBy('m.fecha', 'DESC')
      .addOrderBy('m.cuentaId')
      .addOrderBy('m.orden', 'DESC')
      .skip((f.pagina - 1) * f.porPagina)
      .take(f.porPagina)
      .getManyAndCount();
    return { total, pagina: f.pagina, porPagina: f.porPagina, items };
  }

  /** Movimiento con las líneas de conciliación vigentes (documento o categoría a la que se aplicó). */
  async detalle(empresaId: number, id: number) {
    const movimiento = await this.ds
      .getRepository(Movimiento)
      .findOneBy({ id, empresaId });
    if (!movimiento) throw new NotFoundException('Movimiento no encontrado');
    const lineas: Record<string, unknown>[] = await this.ds.query(
      `SELECT l.id::float8 AS id, l.conciliacion_id::float8 AS "conciliacionId", l.monto_aplicado::float8 AS "montoAplicado",
              c.origen, c.creado_en AS "creadoEn",
              d.id::float8 AS "documentoId", d.tipo_dte AS "tipoDte", d.folio::float8 AS folio,
              d.razon_social AS "razonSocial", d.monto_total::float8 AS "montoTotal",
              cat.id AS "categoriaId", cat.nombre AS categoria
         FROM conciliacion_linea l
         JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
         LEFT JOIN documento d ON d.id = l.documento_id
         LEFT JOIN categoria cat ON cat.id = l.categoria_id
        WHERE l.movimiento_id = $1
        ORDER BY l.id`,
      [id],
    );
    return { ...movimiento, lineas };
  }

  /**
   * Documentos que se pueden aplicar a este movimiento a mano, del más al menos probable:
   * un abono cobra ventas (o notas de crédito de compra) y un cargo paga compras (o notas de
   * crédito de venta). Ordena por monto que calza, parecido del nombre y cercanía de fecha.
   */
  async candidatos(
    empresaId: number,
    id: number,
    f: FiltroCandidatosDto,
  ): Promise<Candidato[]> {
    const mov = await this.ds
      .getRepository(Movimiento)
      .findOneBy({ id, empresaId });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    const disponible = Math.abs(mov.monto) - mov.montoConciliado;
    const q = f.q?.trim();

    const docs = await consultar<Omit<Candidato, 'similitud' | 'montoCalza'>>(
      this.ds,
      `SELECT id::float8 AS id, direccion, tipo_dte AS "tipoDte", folio::float8 AS folio,
              rut_contraparte AS rut, razon_social AS "razonSocial",
              to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision",
              monto_total::float8 AS "montoTotal", saldo_pendiente::float8 AS "saldoPendiente", estado
         FROM documento
        WHERE empresa_id = $1 AND saldo_pendiente > 0
          AND ((direccion = 'emitido') <> (tipo_dte = 61)) = $2
          AND (CASE WHEN $3::text IS NULL THEN estado IN ('pendiente', 'parcial')
                    ELSE estado <> 'anulado'
                         AND (razon_social ILIKE '%' || $3 || '%' OR rut_contraparte ILIKE $3 || '%'
                              OR folio::text = $3) END)`,
      [empresaId, mov.monto > 0, q || null],
    );

    const indice = new IndiceNombres(
      docs.map((d) => ({ id: d.id, nombre: d.razonSocial })),
    );
    const parecido = new Map(
      indice.buscar(mov.contraparteTexto).map((c) => [c.id, c.similitud]),
    );
    const dias = (d: { fechaEmision: string }) =>
      Math.abs(Date.parse(d.fechaEmision) - Date.parse(mov.fecha)) / 86_400_000;

    return docs
      .map((d) => ({
        ...d,
        similitud: parecido.get(d.id) ?? 0,
        montoCalza: d.saldoPendiente === disponible,
      }))
      .map((d) => ({
        d,
        orden:
          (d.montoCalza ? 0.45 : d.saldoPendiente < disponible ? 0.1 : 0) +
          0.45 * d.similitud +
          0.1 * Math.max(0, 1 - dias(d) / 180),
      }))
      .sort((a, b) => b.orden - a.orden)
      .slice(0, 30)
      .map(({ d }) => ({ ...d, similitud: redondear(d.similitud) }));
  }

  async actualizar(
    empresaId: number,
    id: number,
    dto: ActualizarMovimientoDto,
    usuario: UsuarioActual,
  ) {
    return this.ds.transaction(async (em) => {
      const mov = await em.findOne(Movimiento, {
        where: { id, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!mov) throw new NotFoundException('Movimiento no encontrado');
      if (dto.ignorado === true && mov.montoConciliado > 0) {
        throw new BadRequestException(
          'El movimiento tiene conciliaciones: deshágalas antes de ignorarlo',
        );
      }
      if (dto.ignorado !== undefined) mov.ignorado = dto.ignorado;
      if (dto.nota !== undefined) mov.nota = dto.nota || null;
      await em.save(mov);
      await recalcular(em, { movimientos: [id] });
      await auditar(em, {
        empresaId,
        usuarioId: usuario.id,
        accion: 'movimiento.actualizar',
        entidad: 'movimiento',
        entidadId: id,
        detalle: { ...dto },
      });
      return em.findOneBy(Movimiento, { id });
    });
  }
}

@Controller('empresas/:empresaId/movimientos')
export class MovimientosController {
  constructor(private readonly servicio: MovimientosService) {}

  @Get()
  listar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroMovimientosDto,
  ) {
    return this.servicio.listar(empresaId, filtro);
  }

  @Get(':id')
  detalle(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.detalle(empresaId, id);
  }

  @Get(':id/candidatos')
  candidatos(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() filtro: FiltroCandidatosDto,
  ) {
    return this.servicio.candidatos(empresaId, id, filtro);
  }

  @Patch(':id')
  @RolMinimo('operador')
  actualizar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarMovimientoDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.actualizar(empresaId, id, dto, usuario);
  }
}

@Module({
  controllers: [MovimientosController],
  providers: [MovimientosService],
})
export class MovimientosModule {}
