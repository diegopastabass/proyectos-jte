import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import {
  RolMinimo,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import {
  actualizarDevolviendo,
  auditar,
  recalcular,
} from '../common/auditoria';
import { PaginacionDto } from '../common/paginacion';
import { patronAlias } from '../motor/similitud';
import { Conciliacion, ConciliacionLinea } from '../entities';

class LineaDto {
  @Type(() => Number) @IsInt() movimientoId: number;
  @IsOptional() @Type(() => Number) @IsInt() documentoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() categoriaId?: number;
  /** Monto aplicado, siempre positivo (pesos). */
  @Type(() => Number) @IsInt() @Min(1) monto: number;
}

export class CrearConciliacionDto {
  @ValidateNested({ each: true })
  @Type(() => LineaDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  lineas: LineaDto[];

  @IsOptional() @IsString() @MaxLength(500) nota?: string;
}

class FiltroConciliacionesDto extends PaginacionDto {
  @IsOptional() @IsIn(['true', 'false']) incluirDeshechas?: 'true' | 'false';
}

export interface OpcionesConciliacion {
  usuarioId: number | null;
  origen: 'manual' | 'auto' | 'regla';
  score?: number;
}

interface MovBloqueado {
  id: number;
  monto: number;
  monto_conciliado: number;
  ignorado: boolean;
  contraparte_texto: string | null;
  rut_contraparte: string | null;
}

interface DocBloqueado {
  id: number;
  direccion: 'emitido' | 'recibido';
  tipo_dte: number;
  saldo_pendiente: number;
  estado: string;
  contraparte_id: number | null;
}

@Injectable()
export class ConciliacionService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Crea una conciliación en su propia transacción. */
  async crear(
    empresaId: number,
    dto: CrearConciliacionDto,
    opciones: OpcionesConciliacion,
  ) {
    return this.ds.transaction((em) =>
      this.crearEn(em, empresaId, dto, opciones),
    );
  }

  /**
   * Crea una conciliación (manual, sugerencia aceptada o automática del motor) dentro de la
   * transacción `em`. Valida todo con las filas bloqueadas, para que dos usuarios no apliquen
   * el mismo saldo a la vez.
   */
  async crearEn(
    em: EntityManager,
    empresaId: number,
    dto: CrearConciliacionDto,
    opciones: OpcionesConciliacion,
  ) {
    for (const l of dto.lineas) {
      if ((l.documentoId === undefined) === (l.categoriaId === undefined)) {
        throw new BadRequestException(
          'Cada línea debe tener documentoId o categoriaId (solo uno)',
        );
      }
    }

    const movs = await this.bloquear<MovBloqueado>(
      em,
      `SELECT id::float8 AS id, monto::float8 AS monto, monto_conciliado::float8 AS monto_conciliado,
              ignorado, contraparte_texto, rut_contraparte
         FROM movimiento WHERE empresa_id = $1 AND id = ANY($2::bigint[]) ORDER BY id FOR UPDATE`,
      empresaId,
      dto.lineas.map((l) => l.movimientoId),
      'Movimiento',
    );
    const docs = await this.bloquear<DocBloqueado>(
      em,
      `SELECT id::float8 AS id, direccion, tipo_dte, saldo_pendiente::float8 AS saldo_pendiente, estado, contraparte_id
         FROM documento WHERE empresa_id = $1 AND id = ANY($2::bigint[]) ORDER BY id FOR UPDATE`,
      empresaId,
      dto.lineas.filter((l) => l.documentoId).map((l) => l.documentoId!),
      'Documento',
    );
    await this.bloquear(
      em,
      'SELECT id FROM categoria WHERE empresa_id = $1 AND id = ANY($2::int[]) AND activa',
      empresaId,
      dto.lineas.filter((l) => l.categoriaId).map((l) => l.categoriaId!),
      'Categoría',
    );

    this.validar(dto.lineas, movs, docs);

    const conciliacion = await em.save(
      em.create(Conciliacion, {
        empresaId,
        origen: opciones.origen,
        score: opciones.score ?? null,
        nota: dto.nota ?? null,
        creadoPor: opciones.usuarioId,
      }),
    );
    await em.insert(
      ConciliacionLinea,
      dto.lineas.map((l) => ({
        conciliacionId: conciliacion.id,
        movimientoId: l.movimientoId,
        documentoId: l.documentoId ?? null,
        categoriaId: l.categoriaId ?? null,
        montoAplicado: l.monto,
      })),
    );

    await recalcular(em, {
      movimientos: [...movs.keys()],
      documentos: [...docs.keys()],
    });
    await this.aprenderAlias(em, empresaId, dto.lineas, movs, docs, +1);
    // Lo que el motor había sugerido para estos movimientos ya no aplica.
    await em.query(
      `UPDATE sugerencia SET estado = 'obsoleta'
        WHERE movimiento_id = ANY($1::bigint[]) AND estado = 'pendiente'`,
      [[...movs.keys()]],
    );
    await auditar(em, {
      empresaId,
      usuarioId: opciones.usuarioId,
      accion: 'conciliacion.crear',
      entidad: 'conciliacion',
      entidadId: conciliacion.id,
      detalle: {
        origen: opciones.origen,
        score: opciones.score,
        lineas: dto.lineas,
      },
    });
    return this.obtener(em, empresaId, conciliacion.id);
  }

  /** Deshace (no borra) una conciliación y devuelve los saldos a como estaban. */
  async deshacer(empresaId: number, id: number, usuarioId: number) {
    return this.ds.transaction(async (em) => {
      const [fila] = await actualizarDevolviendo<{ id: string }>(
        em,
        `UPDATE conciliacion SET deshecha_en = now(), deshecha_por = $3
          WHERE id = $1 AND empresa_id = $2 AND deshecha_en IS NULL RETURNING id`,
        [id, empresaId, usuarioId],
      );
      if (!fila)
        throw new NotFoundException('Conciliación no encontrada o ya deshecha');

      const lineas = await em.find(ConciliacionLinea, {
        where: { conciliacionId: id },
      });
      const movIds = [...new Set(lineas.map((l) => l.movimientoId))];
      const docIds = [
        ...new Set(
          lineas.filter((l) => l.documentoId).map((l) => l.documentoId!),
        ),
      ];
      await recalcular(em, { movimientos: movIds, documentos: docIds });

      // Lo que se aprendió con esta conciliación deja de contar.
      const filasMov: MovBloqueado[] = await em.query(
        'SELECT id::float8 AS id, contraparte_texto, rut_contraparte FROM movimiento WHERE id = ANY($1::bigint[])',
        [movIds],
      );
      const filasDoc: DocBloqueado[] = await em.query(
        'SELECT id::float8 AS id, contraparte_id FROM documento WHERE id = ANY($1::bigint[])',
        [docIds],
      );
      const movs = new Map(filasMov.map((m) => [m.id, m]));
      const docs = new Map(filasDoc.map((d) => [d.id, d]));
      await this.aprenderAlias(
        em,
        empresaId,
        lineas.map((l) => ({
          movimientoId: l.movimientoId,
          documentoId: l.documentoId ?? undefined,
        })),
        movs,
        docs,
        -1,
      );

      await auditar(em, {
        empresaId,
        usuarioId,
        accion: 'conciliacion.deshacer',
        entidad: 'conciliacion',
        entidadId: id,
      });
      return this.obtener(em, empresaId, id);
    });
  }

  async listar(empresaId: number, f: FiltroConciliacionesDto) {
    const qb = this.ds
      .getRepository(Conciliacion)
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.lineas', 'l')
      .where('c.empresaId = :empresaId', { empresaId });
    if (f.incluirDeshechas !== 'true') qb.andWhere('c.deshechaEn IS NULL');
    const [items, total] = await qb
      .orderBy('c.creadoEn', 'DESC')
      .skip((f.pagina - 1) * f.porPagina)
      .take(f.porPagina)
      .getManyAndCount();
    return { total, pagina: f.pagina, porPagina: f.porPagina, items };
  }

  private async obtener(em: EntityManager, empresaId: number, id: number) {
    return em.findOne(Conciliacion, {
      where: { id, empresaId },
      relations: { lineas: true },
    });
  }

  private async bloquear<T extends { id: number }>(
    em: EntityManager,
    sql: string,
    empresaId: number,
    ids: number[],
    nombre: string,
  ): Promise<Map<number, T>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();
    const filas: T[] = await em.query(sql, [empresaId, unicos]);
    if (filas.length !== unicos.length) {
      const encontrados = new Set(filas.map((f) => Number(f.id)));
      const faltan = unicos.filter((id) => !encontrados.has(id));
      throw new NotFoundException(
        `${nombre} no encontrado o inactivo: ${faltan.join(', ')}`,
      );
    }
    return new Map(filas.map((f) => [Number(f.id), f]));
  }

  private validar(
    lineas: LineaDto[],
    movs: Map<number, MovBloqueado>,
    docs: Map<number, DocBloqueado>,
  ) {
    const porMov = new Map<number, number>();
    const porDoc = new Map<number, number>();
    for (const l of lineas) {
      const mov = movs.get(l.movimientoId)!;
      if (mov.ignorado)
        throw new BadRequestException(
          `El movimiento ${mov.id} está marcado como ignorado`,
        );
      porMov.set(mov.id, (porMov.get(mov.id) ?? 0) + l.monto);

      if (l.documentoId) {
        const doc = docs.get(l.documentoId)!;
        if (doc.estado === 'anulado')
          throw new BadRequestException(`El documento ${doc.id} está anulado`);
        // Un abono cobra una venta (o un reembolso de proveedor contra su nota de crédito);
        // un cargo paga una compra (o devuelve plata a un cliente contra una nota de crédito).
        const esNc = doc.tipo_dte === 61;
        const cobra = (doc.direccion === 'emitido') !== esNc;
        if (mov.monto > 0 !== cobra) {
          throw new BadRequestException(
            `El movimiento ${mov.id} es un ${mov.monto > 0 ? 'abono' : 'cargo'} y no corresponde al documento ${doc.id} ` +
              `(${doc.direccion === 'emitido' ? 'venta' : 'compra'}${esNc ? ', nota de crédito' : ''})`,
          );
        }
        porDoc.set(doc.id, (porDoc.get(doc.id) ?? 0) + l.monto);
      }
    }
    for (const [id, suma] of porMov) {
      const mov = movs.get(id)!;
      const disponible = Math.abs(mov.monto) - mov.monto_conciliado;
      if (suma > disponible) {
        throw new BadRequestException(
          `Al movimiento ${id} le quedan $${disponible} por conciliar y se intentan aplicar $${suma}`,
        );
      }
    }
    for (const [id, suma] of porDoc) {
      const doc = docs.get(id)!;
      if (suma > doc.saldo_pendiente) {
        throw new BadRequestException(
          `El documento ${id} tiene saldo $${doc.saldo_pendiente} y se intentan aplicar $${suma}`,
        );
      }
    }
  }

  /**
   * Aprende "texto de la glosa → contraparte" con cada conciliación confirmada (o lo olvida al deshacer).
   * Así la próxima vez "TEF BANCOESTADO DE COMITE DE AGUA P" ya apunta al cliente correcto.
   */
  private async aprenderAlias(
    em: EntityManager,
    empresaId: number,
    lineas: { movimientoId: number; documentoId?: number }[],
    movs: Map<
      number,
      Pick<MovBloqueado, 'contraparte_texto' | 'rut_contraparte'>
    >,
    docs: Map<number, Pick<DocBloqueado, 'contraparte_id'>>,
    delta: 1 | -1,
  ) {
    const pares = new Set<string>();
    for (const l of lineas) {
      if (!l.documentoId) continue;
      const mov = movs.get(l.movimientoId);
      const patron = patronAlias(mov?.contraparte_texto, mov?.rut_contraparte);
      const contraparteId = docs.get(l.documentoId)?.contraparte_id;
      if (patron && contraparteId)
        pares.add(JSON.stringify([patron, contraparteId]));
    }
    for (const par of pares) {
      const [patron, contraparteId] = JSON.parse(par) as [string, number];
      if (delta > 0) {
        await em.query(
          `INSERT INTO contraparte_alias (empresa_id, contraparte_id, patron) VALUES ($1, $2, $3)
           ON CONFLICT (empresa_id, patron, contraparte_id)
           DO UPDATE SET veces_confirmado = contraparte_alias.veces_confirmado + 1`,
          [empresaId, contraparteId, patron],
        );
      } else {
        await em.query(
          `UPDATE contraparte_alias SET veces_confirmado = veces_confirmado - 1
            WHERE empresa_id = $1 AND contraparte_id = $2 AND patron = $3`,
          [empresaId, contraparteId, patron],
        );
        await em.query(
          'DELETE FROM contraparte_alias WHERE empresa_id = $1 AND contraparte_id = $2 AND patron = $3 AND veces_confirmado <= 0',
          [empresaId, contraparteId, patron],
        );
      }
    }
  }
}

@Controller('empresas/:empresaId/conciliaciones')
export class ConciliacionController {
  constructor(private readonly servicio: ConciliacionService) {}

  @Get()
  listar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroConciliacionesDto,
  ) {
    return this.servicio.listar(empresaId, filtro);
  }

  /**
   * Conciliación manual N:M. Ejemplos de líneas:
   *  - un abono que paga dos facturas: [{movimientoId: 10, documentoId: 5, monto: 41650}, {movimientoId: 10, documentoId: 6, monto: 30000}]
   *  - un cargo que es retiro del dueño: [{movimientoId: 11, categoriaId: 2, monto: 15000}]
   */
  @Post()
  @RolMinimo('operador')
  crear(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearConciliacionDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.crear(empresaId, dto, {
      usuarioId: usuario.id,
      origen: 'manual',
    });
  }

  @Delete(':id')
  @RolMinimo('operador')
  deshacer(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.deshacer(empresaId, id, usuario.id);
  }
}

@Module({
  controllers: [ConciliacionController],
  providers: [ConciliacionService],
  exports: [ConciliacionService],
})
export class ConciliacionModule {}
