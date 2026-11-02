import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
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
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
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
  consultar,
  recalcular,
} from '../common/auditoria';
import { PaginacionDto } from '../common/paginacion';
import {
  ConciliacionModule,
  ConciliacionService,
} from '../conciliacion/conciliacion.module';
import { Regla, Sugerencia } from '../entities';
import {
  type AccionRegla,
  type CondicionRegla,
  type ContraparteMotor,
  type DocumentoMotor,
  type EntradaMotor,
  type MovimientoMotor,
  type LineaPropuesta,
  proponer,
  type Propuesta,
  UMBRAL_AUTOMATICO,
} from './motor';

// ---------------------------------------------------------------- DTOs

class EjecutarMotorDto {
  @IsOptional() @Type(() => Number) @IsInt() cuentaId?: number;
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  /** true: no concilia nada solo, todo queda como sugerencia (útil la primera vez). */
  @IsOptional() @IsBoolean() soloSugerir?: boolean;
}

class FiltroSugerenciasDto extends PaginacionDto {
  @IsOptional()
  @IsIn(['pendiente', 'aceptada', 'rechazada', 'obsoleta'])
  estado: Sugerencia['estado'] = 'pendiente';
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  scoreMin?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  scoreMax?: number;
}

class AceptarSugerenciaDto {
  /** Índice en `alternativas`; si se omite, se acepta la propuesta principal. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) alternativa?: number;
}

class CondicionDto implements CondicionRegla {
  @IsOptional() @IsString() @MinLength(3) glosaContiene?: string;
  @IsOptional() @IsIn(['abono', 'cargo']) signo?: 'abono' | 'cargo';
  @IsOptional() @IsInt() @Min(0) montoMin?: number;
  @IsOptional() @IsInt() @Min(0) montoMax?: number;
  @IsOptional() @IsInt() cuentaId?: number;
}

class AccionDto {
  @IsOptional() @IsInt() categoriaId?: number;
  @IsOptional() @IsIn([true]) ignorar?: true;
}

class CrearReglaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsInt() prioridad?: number;
  @ValidateNested() @Type(() => CondicionDto) condicion: CondicionDto;
  @ValidateNested() @Type(() => AccionDto) accion: AccionDto;
}

class ActualizarReglaDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional() @IsInt() prioridad?: number;
  @IsOptional() @IsBoolean() activa?: boolean;
  @IsOptional()
  @ValidateNested()
  @Type(() => CondicionDto)
  condicion?: CondicionDto;
  @IsOptional() @ValidateNested() @Type(() => AccionDto) accion?: AccionDto;
}

interface FilaMovimiento {
  id: number;
  cuentaId: number;
  fecha: string;
  monto: number;
  montoConciliado: number;
  glosa: string;
  estado: string;
}

interface FilaDocumento {
  id: number;
  direccion: string;
  tipoDte: number;
  folio: number;
  razonSocial: string;
  rut: string;
  fechaEmision: string;
  montoTotal: number;
  saldoPendiente: number;
  estado: string;
}

export interface ResumenMotor {
  movimientosEvaluados: number;
  conciliadosAutomaticamente: number;
  ignoradosPorRegla: number;
  sugerencias: number;
  sinPropuesta: number;
  porNivel: Record<string, number>;
}

// ---------------------------------------------------------------- Servicio

@Injectable()
export class MotorService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly conciliacion: ConciliacionService,
  ) {}

  /**
   * Corre el motor sobre los movimientos pendientes: lo que supera UMBRAL_AUTOMATICO se concilia
   * (origen 'auto' o 'regla'), el resto queda como sugerencia. Cada conciliación automática va en
   * su propia transacción: si una falla (ej. alguien concilió ese documento recién), queda como sugerencia.
   */
  async ejecutar(
    empresaId: number,
    usuarioId: number,
    dto: EjecutarMotorDto,
  ): Promise<ResumenMotor> {
    const entrada = await this.cargarEntrada(empresaId, dto);
    const propuestas = proponer(entrada).sort((a, b) => b.score - a.score);
    const resumen: ResumenMotor = {
      movimientosEvaluados: entrada.movimientos.length,
      conciliadosAutomaticamente: 0,
      ignoradosPorRegla: 0,
      sugerencias: 0,
      sinPropuesta: entrada.movimientos.length - propuestas.length,
      porNivel: {},
    };

    // Las sugerencias pendientes de una corrida anterior se reemplazan por las de esta.
    await this.ds.query(
      `UPDATE sugerencia SET estado = 'obsoleta'
        WHERE empresa_id = $1 AND estado = 'pendiente' AND movimiento_id = ANY($2::bigint[])`,
      [empresaId, entrada.movimientos.map((m) => m.id)],
    );

    for (const p of propuestas) {
      resumen.porNivel[p.nivel] = (resumen.porNivel[p.nivel] ?? 0) + 1;
      if (!dto.soloSugerir && p.score >= UMBRAL_AUTOMATICO) {
        try {
          await this.ds.transaction((em) =>
            this.aplicar(em, empresaId, usuarioId, p),
          );
          if (p.ignorar) resumen.ignoradosPorRegla++;
          else resumen.conciliadosAutomaticamente++;
          continue;
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
        }
      }
      try {
        await this.ds.getRepository(Sugerencia).insert({
          empresaId,
          movimientoId: p.movimientoId,
          nivel: p.nivel,
          score: p.score,
          motivo: p.motivo,
          lineas: p.lineas,
          alternativas: p.alternativas,
          firma: p.firma,
          estado: 'pendiente',
          creadoPor: usuarioId,
        });
      } catch (e) {
        // Otra ejecución simultánea ya dejó una sugerencia pendiente para este movimiento.
        if ((e as { code?: string }).code === '23505') continue;
        throw e;
      }
      resumen.sugerencias++;
    }

    await auditar(this.ds.manager, {
      empresaId,
      usuarioId,
      accion: 'motor.ejecutar',
      entidad: 'empresa',
      entidadId: empresaId,
      detalle: { filtros: { ...dto }, ...resumen },
    });
    return resumen;
  }

  private async aplicar(
    em: EntityManager,
    empresaId: number,
    usuarioId: number,
    p: Propuesta,
  ) {
    if (p.ignorar) {
      await this.ignorarMovimiento(
        em,
        empresaId,
        usuarioId,
        p.movimientoId,
        p.motivo,
      );
      return null;
    }
    return this.conciliacion.crearEn(
      em,
      empresaId,
      { lineas: p.lineas, nota: p.motivo },
      {
        usuarioId,
        origen: p.nivel === 'regla' ? 'regla' : 'auto',
        score: p.score,
      },
    );
  }

  private async ignorarMovimiento(
    em: EntityManager,
    empresaId: number,
    usuarioId: number,
    movimientoId: number,
    motivo: string,
  ) {
    const filas = await actualizarDevolviendo(
      em,
      `UPDATE movimiento SET ignorado = true, nota = COALESCE(nota, $3)
        WHERE id = $1 AND empresa_id = $2 AND monto_conciliado = 0 AND NOT ignorado RETURNING id`,
      [movimientoId, empresaId, motivo],
    );
    if (filas.length === 0)
      throw new BadRequestException('El movimiento ya no se puede ignorar');
    await recalcular(em, { movimientos: [movimientoId] });
    await em.query(
      `UPDATE sugerencia SET estado = 'obsoleta' WHERE movimiento_id = $1 AND estado = 'pendiente'`,
      [movimientoId],
    );
    await auditar(em, {
      empresaId,
      usuarioId,
      accion: 'movimiento.ignorar',
      entidad: 'movimiento',
      entidadId: movimientoId,
      detalle: { motivo },
    });
  }

  private async cargarEntrada(
    empresaId: number,
    f: EjecutarMotorDto,
  ): Promise<EntradaMotor> {
    const movimientos = await consultar<MovimientoMotor>(
      this.ds,
      `SELECT id::float8 AS id, cuenta_id AS "cuentaId", to_char(fecha, 'YYYY-MM-DD') AS fecha,
              monto::float8 AS monto, (abs(monto) - monto_conciliado)::float8 AS disponible,
              glosa_normalizada AS "glosaNormalizada", contraparte_texto AS "contraparteTexto",
              rut_contraparte AS "rutContraparte"
         FROM movimiento
        WHERE empresa_id = $1 AND estado IN ('pendiente', 'parcial') AND NOT ignorado
          AND ($2::int IS NULL OR cuenta_id = $2)
          AND ($3::date IS NULL OR fecha >= $3)
          AND ($4::date IS NULL OR fecha <= $4)
        ORDER BY fecha, id`,
      [empresaId, f.cuentaId ?? null, f.desde ?? null, f.hasta ?? null],
    );
    const ids = movimientos.map((m) => m.id);
    const [documentos, contrapartes, alias, reglas, categorias, rechazadas] =
      await Promise.all([
        consultar<DocumentoMotor>(
          this.ds,
          `SELECT id::float8 AS id, direccion, tipo_dte AS "tipoDte", folio::float8 AS folio,
                rut_contraparte AS rut, razon_social AS "razonSocial", contraparte_id AS "contraparteId",
                to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision", saldo_pendiente::float8 AS saldo
           FROM documento
          WHERE empresa_id = $1 AND saldo_pendiente > 0 AND estado IN ('pendiente', 'parcial')`,
          [empresaId],
        ),
        consultar<ContraparteMotor>(
          this.ds,
          `SELECT id, rut, nombre, tipo, categoria_id AS "categoriaId" FROM contraparte WHERE empresa_id = $1`,
          [empresaId],
        ),
        consultar<EntradaMotor['alias'][number]>(
          this.ds,
          `SELECT patron, contraparte_id AS "contraparteId", veces_confirmado AS veces
           FROM contraparte_alias WHERE empresa_id = $1`,
          [empresaId],
        ),
        this.ds
          .getRepository(Regla)
          .find({ where: { empresaId, activa: true } }),
        consultar<{ id: number; nombre: string }>(
          this.ds,
          'SELECT id, nombre FROM categoria WHERE empresa_id = $1 AND activa',
          [empresaId],
        ),
        consultar<{ movimientoId: number; firma: string }>(
          this.ds,
          `SELECT movimiento_id::float8 AS "movimientoId", firma FROM sugerencia
          WHERE estado = 'rechazada' AND movimiento_id = ANY($1::bigint[])`,
          [ids],
        ),
      ]);

    const mapaRechazadas = new Map<number, Set<string>>();
    for (const r of rechazadas) {
      mapaRechazadas.set(
        r.movimientoId,
        (mapaRechazadas.get(r.movimientoId) ?? new Set()).add(r.firma),
      );
    }
    return {
      movimientos,
      documentos,
      contrapartes,
      alias,
      reglas,
      categorias,
      rechazadas: mapaRechazadas,
    };
  }

  // ------------------------------------------------------------ Sugerencias

  /** Sugerencias con el movimiento y los documentos/categorías que proponen, listas para mostrar. */
  async listarSugerencias(empresaId: number, f: FiltroSugerenciasDto) {
    const qb = this.ds
      .getRepository(Sugerencia)
      .createQueryBuilder('s')
      .where('s.empresaId = :empresaId AND s.estado = :estado', {
        empresaId,
        estado: f.estado,
      });
    if (f.scoreMin !== undefined)
      qb.andWhere('s.score >= :scoreMin', { scoreMin: f.scoreMin });
    if (f.scoreMax !== undefined)
      qb.andWhere('s.score < :scoreMax', { scoreMax: f.scoreMax });
    const [sugerencias, total] = await qb
      .orderBy('s.score', 'DESC')
      .addOrderBy('s.id')
      .skip((f.pagina - 1) * f.porPagina)
      .take(f.porPagina)
      .getManyAndCount();

    const todasLasLineas = sugerencias.flatMap((s) => [
      ...s.lineas,
      ...s.alternativas.flatMap((a) => a.lineas),
    ]);
    const docIds = [
      ...new Set(
        todasLasLineas.filter((l) => l.documentoId).map((l) => l.documentoId!),
      ),
    ];
    const catIds = [
      ...new Set(
        todasLasLineas.filter((l) => l.categoriaId).map((l) => l.categoriaId!),
      ),
    ];
    const movIds = sugerencias.map((s) => s.movimientoId);

    const [movimientos, documentos, categorias] = await Promise.all([
      consultar<FilaMovimiento>(
        this.ds,
        `SELECT id::float8 AS id, cuenta_id AS "cuentaId", to_char(fecha, 'YYYY-MM-DD') AS fecha,
                monto::float8 AS monto, monto_conciliado::float8 AS "montoConciliado", glosa, estado
           FROM movimiento WHERE id = ANY($1::bigint[])`,
        [movIds],
      ),
      consultar<FilaDocumento>(
        this.ds,
        `SELECT id::float8 AS id, direccion, tipo_dte AS "tipoDte", folio::float8 AS folio,
                razon_social AS "razonSocial", rut_contraparte AS rut,
                to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision",
                monto_total::float8 AS "montoTotal", saldo_pendiente::float8 AS "saldoPendiente", estado
           FROM documento WHERE id = ANY($1::bigint[])`,
        [docIds],
      ),
      consultar<{ id: number; nombre: string; tipo: string }>(
        this.ds,
        'SELECT id, nombre, tipo FROM categoria WHERE id = ANY($1::int[])',
        [catIds],
      ),
    ]);
    const porId = <T extends { id: number }>(filas: T[]) =>
      Object.fromEntries(filas.map((x) => [x.id, x]));
    const movs = porId(movimientos);

    return {
      total,
      pagina: f.pagina,
      porPagina: f.porPagina,
      items: sugerencias.map((s) => ({
        ...s,
        movimiento: movs[s.movimientoId] ?? null,
      })),
      documentos: porId(documentos),
      categorias: porId(categorias),
    };
  }

  async aceptar(
    empresaId: number,
    id: number,
    dto: AceptarSugerenciaDto,
    usuarioId: number,
  ) {
    return this.ds.transaction(async (em) => {
      const s = await em.findOne(Sugerencia, {
        where: { id, empresaId, estado: 'pendiente' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!s)
        throw new NotFoundException('Sugerencia no encontrada o ya resuelta');

      let opcion: { lineas: LineaPropuesta[]; score: number; motivo: string } =
        s;
      if (dto.alternativa !== undefined) {
        const alt = s.alternativas[dto.alternativa];
        if (!alt)
          throw new BadRequestException(
            `La sugerencia tiene ${s.alternativas.length} alternativa(s)`,
          );
        opcion = alt;
      }

      let conciliacionId: number | null = null;
      if (opcion.lineas.length === 0) {
        await this.ignorarMovimiento(
          em,
          empresaId,
          usuarioId,
          s.movimientoId,
          opcion.motivo,
        );
      } else {
        const c = await this.conciliacion.crearEn(
          em,
          empresaId,
          { lineas: opcion.lineas, nota: opcion.motivo },
          { usuarioId, origen: 'manual', score: opcion.score },
        );
        conciliacionId = c?.id ?? null;
      }
      // crearEn deja 'obsoleta' toda sugerencia pendiente del movimiento; esta queda como aceptada.
      await em.update(
        Sugerencia,
        { id },
        {
          estado: 'aceptada',
          conciliacionId,
          resueltaPor: usuarioId,
          resueltaEn: new Date(),
        },
      );
      await auditar(em, {
        empresaId,
        usuarioId,
        accion: 'sugerencia.aceptar',
        entidad: 'sugerencia',
        entidadId: id,
        detalle: { alternativa: dto.alternativa ?? null, conciliacionId },
      });
      return em.findOneBy(Sugerencia, { id });
    });
  }

  /** La propuesta rechazada no se vuelve a sugerir para ese movimiento (sí sus alternativas). */
  async rechazar(empresaId: number, id: number, usuarioId: number) {
    return this.ds.transaction(async (em) => {
      const filas = await actualizarDevolviendo(
        em,
        `UPDATE sugerencia SET estado = 'rechazada', resuelta_por = $3, resuelta_en = now()
          WHERE id = $1 AND empresa_id = $2 AND estado = 'pendiente' RETURNING id`,
        [id, empresaId, usuarioId],
      );
      if (filas.length === 0)
        throw new NotFoundException('Sugerencia no encontrada o ya resuelta');
      await auditar(em, {
        empresaId,
        usuarioId,
        accion: 'sugerencia.rechazar',
        entidad: 'sugerencia',
        entidadId: id,
      });
      return em.findOneBy(Sugerencia, { id });
    });
  }

  // ------------------------------------------------------------ Reglas

  listarReglas(empresaId: number) {
    return this.ds
      .getRepository(Regla)
      .find({ where: { empresaId }, order: { prioridad: 'ASC', id: 'ASC' } });
  }

  async crearRegla(empresaId: number, dto: CrearReglaDto, usuarioId: number) {
    const condicion = this.validarCondicion(dto.condicion);
    const accion = await this.validarAccion(empresaId, dto.accion);
    const repo = this.ds.getRepository(Regla);
    const regla = await repo.save(
      repo.create({
        empresaId,
        nombre: dto.nombre.trim(),
        prioridad: dto.prioridad ?? 100,
        activa: true,
        condicion,
        accion,
      }),
    );
    await auditar(this.ds.manager, {
      empresaId,
      usuarioId,
      accion: 'regla.crear',
      entidad: 'regla',
      entidadId: regla.id,
      detalle: { ...dto },
    });
    return regla;
  }

  async actualizarRegla(
    empresaId: number,
    id: number,
    dto: ActualizarReglaDto,
    usuarioId: number,
  ) {
    const repo = this.ds.getRepository(Regla);
    const regla = await repo.findOneBy({ id, empresaId });
    if (!regla) throw new NotFoundException('Regla no encontrada');
    if (dto.nombre !== undefined) regla.nombre = dto.nombre.trim();
    if (dto.prioridad !== undefined) regla.prioridad = dto.prioridad;
    if (dto.activa !== undefined) regla.activa = dto.activa;
    if (dto.condicion) regla.condicion = this.validarCondicion(dto.condicion);
    if (dto.accion)
      regla.accion = await this.validarAccion(empresaId, dto.accion);
    await repo.save(regla);
    await auditar(this.ds.manager, {
      empresaId,
      usuarioId,
      accion: 'regla.actualizar',
      entidad: 'regla',
      entidadId: id,
      detalle: { ...dto },
    });
    return regla;
  }

  async eliminarRegla(empresaId: number, id: number, usuarioId: number) {
    const resultado = await this.ds
      .getRepository(Regla)
      .delete({ id, empresaId });
    if (!resultado.affected) throw new NotFoundException('Regla no encontrada');
    await auditar(this.ds.manager, {
      empresaId,
      usuarioId,
      accion: 'regla.eliminar',
      entidad: 'regla',
      entidadId: id,
    });
  }

  /** Una regla sin condiciones aplicaría a todos los movimientos: se exige al menos texto o cuenta+monto. */
  private validarCondicion(c: CondicionDto): CondicionRegla {
    const limpia: CondicionRegla = Object.fromEntries(
      Object.entries(c).filter(([, v]) => v !== undefined && v !== null),
    );
    const acotaMonto =
      limpia.montoMin !== undefined || limpia.montoMax !== undefined;
    if (
      !limpia.glosaContiene &&
      !(limpia.cuentaId !== undefined && acotaMonto)
    ) {
      throw new BadRequestException(
        'La condición debe incluir glosaContiene, o cuentaId junto a un rango de monto',
      );
    }
    if (
      limpia.montoMin !== undefined &&
      limpia.montoMax !== undefined &&
      limpia.montoMin > limpia.montoMax
    ) {
      throw new BadRequestException('montoMin no puede ser mayor que montoMax');
    }
    return limpia;
  }

  private async validarAccion(
    empresaId: number,
    a: AccionDto,
  ): Promise<AccionRegla> {
    if ((a.categoriaId === undefined) === (a.ignorar === undefined)) {
      throw new BadRequestException(
        'La acción debe ser {categoriaId} o {ignorar: true}',
      );
    }
    if (a.ignorar) return { ignorar: true };
    const [cat] = await consultar<{ id: number }>(
      this.ds,

      'SELECT id FROM categoria WHERE id = $1 AND empresa_id = $2 AND activa',
      [a.categoriaId, empresaId],
    );
    if (!cat)
      throw new BadRequestException('Categoría no encontrada o inactiva');
    return { categoriaId: a.categoriaId! };
  }
}

// ---------------------------------------------------------------- Controladores

@Controller('empresas/:empresaId')
export class MotorController {
  constructor(private readonly servicio: MotorService) {}

  @Post('motor/ejecutar')
  @HttpCode(200)
  @RolMinimo('operador')
  ejecutar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: EjecutarMotorDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.ejecutar(empresaId, usuario.id, dto);
  }

  @Get('sugerencias')
  sugerencias(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroSugerenciasDto,
  ) {
    return this.servicio.listarSugerencias(empresaId, filtro);
  }

  @Post('sugerencias/:id/aceptar')
  @HttpCode(200)
  @RolMinimo('operador')
  aceptar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AceptarSugerenciaDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.aceptar(empresaId, id, dto, usuario.id);
  }

  @Post('sugerencias/:id/rechazar')
  @HttpCode(200)
  @RolMinimo('operador')
  rechazar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.rechazar(empresaId, id, usuario.id);
  }

  @Get('reglas')
  reglas(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.listarReglas(empresaId);
  }

  @Post('reglas')
  @RolMinimo('operador')
  crearRegla(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearReglaDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.crearRegla(empresaId, dto, usuario.id);
  }

  @Patch('reglas/:id')
  @RolMinimo('operador')
  actualizarRegla(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarReglaDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.actualizarRegla(empresaId, id, dto, usuario.id);
  }

  @Delete('reglas/:id')
  @HttpCode(204)
  @RolMinimo('operador')
  eliminarRegla(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.eliminarRegla(empresaId, id, usuario.id);
  }
}

@Module({
  imports: [ConciliacionModule],
  controllers: [MotorController],
  providers: [MotorService],
})
export class MotorModule {}
