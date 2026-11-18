import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  RolMinimo,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import { auditar, consultar } from '../common/auditoria';
import { Proyecto } from '../entities';
import {
  balanceVacio,
  calcularBalances,
  SQL_MOVIMIENTOS_SIN_DOCUMENTO,
} from './balance';

class FiltroProyectosDto {
  @IsOptional() @IsIn(['true', 'false']) incluirInactivos?: 'true' | 'false';
  /** Acota el balance: documentos por fecha de emisión y movimientos por fecha. */
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

class CrearProyectoDto {
  @IsString() @IsNotEmpty() @MaxLength(120) nombre: string;
  @IsOptional() @IsString() @MaxLength(40) codigo?: string;
  @IsOptional() @IsString() @MaxLength(1000) descripcion?: string;
  @IsOptional() @IsInt() contraparteId?: number;
  @IsOptional() @IsDateString() fechaInicio?: string;
  @IsOptional() @IsDateString() fechaFin?: string;
  @IsOptional() @IsInt() @Min(0) presupuesto?: number;
}

class ActualizarProyectoDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(40) codigo?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) descripcion?: string | null;
  @IsOptional() @IsInt() contraparteId?: number | null;
  @IsOptional() @IsDateString() fechaInicio?: string | null;
  @IsOptional() @IsDateString() fechaFin?: string | null;
  @IsOptional() @IsInt() @Min(0) presupuesto?: number | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}

class AsignarDto {
  /** null = sacar del proyecto en que estén. */
  @ValidateIf((o: AsignarDto) => o.proyectoId !== null)
  @IsInt()
  proyectoId: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  movimientoIds?: number[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  documentoIds?: number[];
}

/** Violación de un índice único de Postgres. */
function esDuplicado(e: unknown) {
  return (
    e instanceof QueryFailedError &&
    (e.driverError as { code?: string }).code === '23505'
  );
}

@Injectable()
export class ProyectosService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Proyectos con su balance (acotado a las fechas, si vienen). */
  async listar(empresaId: number, f: FiltroProyectosDto) {
    const proyectos = await this.ds.getRepository(Proyecto).find({
      where: {
        empresaId,
        ...(f.incluirInactivos === 'true' ? {} : { activo: true }),
      },
      order: { activo: 'DESC', nombre: 'ASC' },
    });
    const balances = await calcularBalances(this.ds, empresaId, {
      proyectoIds: proyectos.map((p) => p.id),
      desde: f.desde,
      hasta: f.hasta,
    });
    return proyectos.map((p) => ({
      ...p,
      balance: balances.get(p.id) ?? balanceVacio(),
    }));
  }

  /** Proyecto con su balance, desglose por categoría y lo que tiene asignado. */
  async detalle(empresaId: number, id: number, f: FiltroProyectosDto) {
    const proyecto = await this.ds
      .getRepository(Proyecto)
      .findOneBy({ id, empresaId });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    const params = [id, f.desde ?? null, f.hasta ?? null];

    const [balances, documentos, movimientos, categorias] = await Promise.all([
      calcularBalances(this.ds, empresaId, {
        proyectoIds: [id],
        desde: f.desde,
        hasta: f.hasta,
      }),
      consultar(
        this.ds,
        `SELECT id::float8 AS id, direccion, tipo_dte AS "tipoDte", folio::float8 AS folio,
                rut_contraparte AS "rutContraparte", razon_social AS "razonSocial",
                to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision",
                monto_neto::float8 AS "montoNeto", monto_iva::float8 AS "montoIva",
                monto_total::float8 AS "montoTotal", saldo_pendiente::float8 AS "saldoPendiente", estado
           FROM documento
          WHERE proyecto_id = $1 AND estado <> 'anulado'
            AND ($2::date IS NULL OR fecha_emision >= $2) AND ($3::date IS NULL OR fecha_emision <= $3)
          ORDER BY fecha_emision DESC, id DESC
          LIMIT 1000`,
        params,
      ),
      consultar(
        this.ds,
        `SELECT x.id::float8 AS id, to_char(x.fecha, 'YYYY-MM-DD') AS fecha, x.monto::float8 AS monto,
                x.sin_documento::float8 AS "sinDocumento",
                LEAST(x.iva_factura + x.iva_boleta, x.sin_documento)::float8 AS iva,
                m.glosa, m.estado,
                (SELECT string_agg(DISTINCT cat.nombre, ', ')
                   FROM conciliacion_linea l
                   JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
                   JOIN categoria cat ON cat.id = l.categoria_id
                  WHERE l.movimiento_id = x.id) AS categorias,
                (SELECT count(*)::int FROM comprobante k
                  WHERE k.movimiento_id = x.id AND k.eliminado_en IS NULL) AS "nComprobantes"
           FROM (${SQL_MOVIMIENTOS_SIN_DOCUMENTO} AND m.proyecto_id = $1
                   AND ($2::date IS NULL OR m.fecha >= $2) AND ($3::date IS NULL OR m.fecha <= $3)) x
           JOIN movimiento m ON m.id = x.id
          ORDER BY x.fecha DESC, x.id DESC
          LIMIT 1000`,
        params,
      ),
      // De qué se compone: categorías de los movimientos, lo que falta conciliar y las facturas.
      consultar<{
        categoriaId: number | null;
        nombre: string;
        gastos: number;
        ingresos: number;
      }>(
        this.ds,
        `SELECT cat.id AS "categoriaId", cat.nombre,
                COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto < 0), 0)::float8 AS gastos,
                COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto > 0), 0)::float8 AS ingresos
           FROM movimiento m
           JOIN conciliacion_linea l ON l.movimiento_id = m.id
           JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
           JOIN categoria cat ON cat.id = l.categoria_id
          WHERE m.proyecto_id = $1 AND NOT m.ignorado
            AND ($2::date IS NULL OR m.fecha >= $2) AND ($3::date IS NULL OR m.fecha <= $3)
          GROUP BY cat.id, cat.nombre
         UNION ALL
         SELECT NULL, 'Sin conciliar',
                COALESCE(sum(abs(monto) - monto_conciliado) FILTER (WHERE monto < 0), 0)::float8,
                COALESCE(sum(abs(monto) - monto_conciliado) FILTER (WHERE monto > 0), 0)::float8
           FROM movimiento
          WHERE proyecto_id = $1 AND NOT ignorado AND monto_conciliado < abs(monto)
            AND ($2::date IS NULL OR fecha >= $2) AND ($3::date IS NULL OR fecha <= $3)
         UNION ALL
         SELECT NULL, CASE direccion WHEN 'emitido' THEN 'Facturas de venta' ELSE 'Facturas de compra' END,
                COALESCE(sum(CASE WHEN tipo_dte = 61 THEN -1 ELSE 1 END * monto_total) FILTER (WHERE direccion = 'recibido'), 0)::float8,
                COALESCE(sum(CASE WHEN tipo_dte = 61 THEN -1 ELSE 1 END * monto_total) FILTER (WHERE direccion = 'emitido'), 0)::float8
           FROM documento
          WHERE proyecto_id = $1 AND estado <> 'anulado'
            AND ($2::date IS NULL OR fecha_emision >= $2) AND ($3::date IS NULL OR fecha_emision <= $3)
          GROUP BY direccion`,
        params,
      ),
    ]);

    return {
      ...proyecto,
      balance: balances.get(id) ?? balanceVacio(),
      porCategoria: categorias
        .filter((c) => c.gastos !== 0 || c.ingresos !== 0)
        .sort((a, b) => b.gastos + b.ingresos - (a.gastos + a.ingresos)),
      documentos,
      movimientos,
    };
  }

  async crear(
    empresaId: number,
    dto: CrearProyectoDto,
    usuario: UsuarioActual,
  ) {
    await this.validarContraparte(empresaId, dto.contraparteId);
    return this.ds.transaction(async (em) => {
      try {
        const p = await em.save(
          em.create(Proyecto, {
            empresaId,
            nombre: dto.nombre.trim(),
            codigo: dto.codigo?.trim() || null,
            descripcion: dto.descripcion?.trim() || null,
            contraparteId: dto.contraparteId ?? null,
            fechaInicio: dto.fechaInicio ?? null,
            fechaFin: dto.fechaFin ?? null,
            presupuesto: dto.presupuesto ?? null,
            activo: true,
          }),
        );
        await auditar(em, {
          empresaId,
          usuarioId: usuario.id,
          accion: 'proyecto.crear',
          entidad: 'proyecto',
          entidadId: p.id,
          detalle: { ...dto },
        });
        return p;
      } catch (e) {
        if (esDuplicado(e))
          throw new ConflictException(
            'Ya existe un proyecto con ese nombre o código',
          );
        throw e;
      }
    });
  }

  async actualizar(
    empresaId: number,
    id: number,
    dto: ActualizarProyectoDto,
    usuario: UsuarioActual,
  ) {
    if (dto.contraparteId)
      await this.validarContraparte(empresaId, dto.contraparteId);
    return this.ds.transaction(async (em) => {
      const p = await em.findOneBy(Proyecto, { id, empresaId });
      if (!p) throw new NotFoundException('Proyecto no encontrado');
      if (dto.nombre !== undefined) p.nombre = dto.nombre.trim();
      if (dto.codigo !== undefined) p.codigo = dto.codigo?.trim() || null;
      if (dto.descripcion !== undefined)
        p.descripcion = dto.descripcion?.trim() || null;
      if (dto.contraparteId !== undefined) p.contraparteId = dto.contraparteId;
      if (dto.fechaInicio !== undefined) p.fechaInicio = dto.fechaInicio;
      if (dto.fechaFin !== undefined) p.fechaFin = dto.fechaFin;
      if (dto.presupuesto !== undefined) p.presupuesto = dto.presupuesto;
      if (dto.activo !== undefined) p.activo = dto.activo;
      try {
        await em.save(p);
      } catch (e) {
        if (esDuplicado(e))
          throw new ConflictException(
            'Ya existe un proyecto con ese nombre o código',
          );
        throw e;
      }
      await auditar(em, {
        empresaId,
        usuarioId: usuario.id,
        accion: 'proyecto.actualizar',
        entidad: 'proyecto',
        entidadId: id,
        detalle: { ...dto },
      });
      return p;
    });
  }

  /**
   * Asigna movimientos y documentos a un proyecto (o los saca, con proyectoId null).
   * Al asignar un movimiento, las facturas con que se concilió y que no tienen proyecto
   * se van con él: así el gasto queda completo sin tener que buscarlas.
   */
  async asignar(empresaId: number, dto: AsignarDto, usuario: UsuarioActual) {
    const movimientoIds = [...new Set(dto.movimientoIds ?? [])];
    const documentoIds = [...new Set(dto.documentoIds ?? [])];
    if (movimientoIds.length + documentoIds.length === 0)
      throw new BadRequestException('Indique movimientos o documentos');

    return this.ds.transaction(async (em) => {
      if (dto.proyectoId !== null) {
        const p = await em.findOneBy(Proyecto, {
          id: dto.proyectoId,
          empresaId,
        });
        if (!p) throw new NotFoundException('Proyecto no encontrado');
        if (!p.activo)
          throw new BadRequestException(
            'El proyecto está cerrado: reactívelo para asignarle más',
          );
      }
      const actualizar = async (tabla: string, ids: number[]) => {
        if (!ids.length) return 0;
        const [, n]: [unknown, number] = await em.query(
          `UPDATE ${tabla} SET proyecto_id = $1 WHERE empresa_id = $2 AND id = ANY($3::bigint[])`,
          [dto.proyectoId, empresaId, ids],
        );
        if (n !== ids.length)
          throw new NotFoundException(
            `Algunos ${tabla === 'movimiento' ? 'movimientos' : 'documentos'} no existen`,
          );
        return n;
      };
      const movimientos = await actualizar('movimiento', movimientoIds);
      const documentos = await actualizar('documento', documentoIds);

      let documentosArrastrados = 0;
      if (dto.proyectoId !== null && movimientoIds.length) {
        const [, n]: [unknown, number] = await em.query(
          `UPDATE documento d SET proyecto_id = $1
            WHERE d.empresa_id = $2 AND d.proyecto_id IS NULL
              AND d.id IN (SELECT l.documento_id FROM conciliacion_linea l
                             JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
                            WHERE l.movimiento_id = ANY($3::bigint[]) AND l.documento_id IS NOT NULL)`,
          [dto.proyectoId, empresaId, movimientoIds],
        );
        documentosArrastrados = n;
      }

      await auditar(em, {
        empresaId,
        usuarioId: usuario.id,
        accion: 'proyecto.asignar',
        entidad: 'proyecto',
        entidadId: dto.proyectoId,
        detalle: { movimientoIds, documentoIds, documentosArrastrados },
      });
      return { movimientos, documentos, documentosArrastrados };
    });
  }

  private async validarContraparte(empresaId: number, id?: number | null) {
    if (!id) return;
    const [fila] = await consultar(
      this.ds,
      'SELECT 1 FROM contraparte WHERE id = $1 AND empresa_id = $2',
      [id, empresaId],
    );
    if (!fila) throw new NotFoundException('Contraparte no encontrada');
  }
}

@Controller('empresas/:empresaId/proyectos')
export class ProyectosController {
  constructor(private readonly servicio: ProyectosService) {}

  @Get()
  listar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroProyectosDto,
  ) {
    return this.servicio.listar(empresaId, filtro);
  }

  /** { proyectoId | null, movimientoIds?, documentoIds? } */
  @Post('asignar')
  @RolMinimo('operador')
  asignar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: AsignarDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.asignar(empresaId, dto, usuario);
  }

  @Get(':id')
  detalle(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() filtro: FiltroProyectosDto,
  ) {
    return this.servicio.detalle(empresaId, id, filtro);
  }

  @Post()
  @RolMinimo('operador')
  crear(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearProyectoDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.crear(empresaId, dto, usuario);
  }

  @Patch(':id')
  @RolMinimo('operador')
  actualizar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProyectoDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.actualizar(empresaId, id, dto, usuario);
  }
}

@Module({
  controllers: [ProyectosController],
  providers: [ProyectosService],
})
export class ProyectosModule {}
