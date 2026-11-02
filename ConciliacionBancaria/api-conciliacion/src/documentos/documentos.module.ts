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
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DataSource } from 'typeorm';
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
import { Pagina, PaginacionDto } from '../common/paginacion';
import { normalizarRut } from '../common/rut';
import { type Direccion, Documento, type EstadoDocumento } from '../entities';

export const NOMBRES_DTE: Record<number, string> = {
  33: 'Factura electrónica',
  34: 'Factura exenta',
  39: 'Boleta',
  41: 'Boleta exenta',
  43: 'Liquidación factura',
  46: 'Factura de compra',
  52: 'Guía de despacho',
  56: 'Nota de débito',
  61: 'Nota de crédito',
  110: 'Factura de exportación',
};

class FiltroDocumentosDto extends PaginacionDto {
  @IsOptional() @IsIn(['emitido', 'recibido']) direccion?: Direccion;
  @IsOptional()
  @IsIn(['pendiente', 'parcial', 'pagado', 'anulado', 'excluido'])
  estado?: EstadoDocumento;
  /** Atajo: pendiente + parcial. */
  @IsOptional() @IsIn(['true', 'false']) conSaldo?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() tipoDte?: number;
  @IsOptional() @IsString() rut?: string;
  @IsOptional() @Type(() => Number) @IsInt() folio?: number;
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  /** Busca en la razón social. */
  @IsOptional() @IsString() q?: string;
}

class AplicarNotaCreditoDto {
  @Type(() => Number) @IsInt() documentoId: number;
  /** Si se omite, se aplica lo máximo posible. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) monto?: number;
}

@Injectable()
export class DocumentosService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listar(
    empresaId: number,
    f: FiltroDocumentosDto,
  ): Promise<Pagina<Documento>> {
    const qb = this.ds
      .getRepository(Documento)
      .createQueryBuilder('d')
      .where('d.empresaId = :empresaId', { empresaId });
    if (f.direccion)
      qb.andWhere('d.direccion = :direccion', { direccion: f.direccion });
    if (f.estado) qb.andWhere('d.estado = :estado', { estado: f.estado });
    if (f.conSaldo === 'true')
      qb.andWhere(
        "d.saldoPendiente > 0 AND d.estado IN ('pendiente', 'parcial')",
      );
    if (f.conSaldo === 'false') qb.andWhere('d.saldoPendiente = 0');
    if (f.tipoDte) qb.andWhere('d.tipoDte = :tipoDte', { tipoDte: f.tipoDte });
    if (f.rut)
      qb.andWhere('d.rutContraparte = :rut', {
        rut: normalizarRut(f.rut) ?? f.rut,
      });
    if (f.folio) qb.andWhere('d.folio = :folio', { folio: f.folio });
    if (f.desde) qb.andWhere('d.fechaEmision >= :desde', { desde: f.desde });
    if (f.hasta) qb.andWhere('d.fechaEmision <= :hasta', { hasta: f.hasta });
    if (f.q) qb.andWhere('d.razonSocial ILIKE :q', { q: `%${f.q}%` });

    const [items, total] = await qb
      .orderBy('d.fechaEmision', 'DESC')
      .addOrderBy('d.folio', 'DESC')
      .skip((f.pagina - 1) * f.porPagina)
      .take(f.porPagina)
      .getManyAndCount();
    return { total, pagina: f.pagina, porPagina: f.porPagina, items };
  }

  /** Documento con los pagos (líneas de conciliación) y notas de crédito vigentes. */
  async detalle(empresaId: number, id: number) {
    const documento = await this.ds
      .getRepository(Documento)
      .findOneBy({ id, empresaId });
    if (!documento) throw new NotFoundException('Documento no encontrado');
    const pagos: Record<string, unknown>[] = await this.ds.query(
      `SELECT l.id::float8 AS id, l.conciliacion_id::float8 AS "conciliacionId", l.monto_aplicado::float8 AS "montoAplicado",
              c.origen, m.id::float8 AS "movimientoId", m.fecha, m.glosa, m.monto::float8 AS monto
         FROM conciliacion_linea l
         JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
         JOIN movimiento m ON m.id = l.movimiento_id
        WHERE l.documento_id = $1
        ORDER BY m.fecha`,
      [id],
    );
    const notasCredito: Record<string, unknown>[] = await this.ds.query(
      `SELECT n.id, n.monto::float8 AS monto, n.origen, n.creado_en AS "creadoEn",
              n.nota_credito_id::float8 AS "notaCreditoId", n.documento_id::float8 AS "documentoId",
              o.tipo_dte AS "tipoDte", o.folio::float8 AS folio
         FROM nota_credito_aplicacion n
         JOIN documento o ON o.id = CASE WHEN n.documento_id = $1 THEN n.nota_credito_id ELSE n.documento_id END
        WHERE (n.documento_id = $1 OR n.nota_credito_id = $1) AND n.deshecha_en IS NULL
        ORDER BY n.id`,
      [id],
    );
    return {
      ...documento,
      tipoNombre: NOMBRES_DTE[documento.tipoDte] ?? null,
      pagos,
      notasCredito,
    };
  }

  /**
   * Aplica una nota de crédito a una factura del mismo emisor/receptor. Necesario en compras,
   * porque el RCV de compras no trae el documento referenciado.
   */
  async aplicarNotaCredito(
    empresaId: number,
    notaId: number,
    dto: AplicarNotaCreditoDto,
    usuario: UsuarioActual,
  ) {
    return this.ds.transaction(async (em) => {
      const docs: Documento[] = await em
        .getRepository(Documento)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.empresaId = :empresaId AND d.id IN (:...ids)', {
          empresaId,
          ids: [notaId, dto.documentoId],
        })
        .orderBy('d.id')
        .getMany();
      const nota = docs.find((d) => d.id === notaId);
      const doc = docs.find((d) => d.id === dto.documentoId);
      if (!nota || !doc) throw new NotFoundException('Documento no encontrado');
      if (nota.tipoDte !== 61)
        throw new BadRequestException(
          'El documento de origen no es una nota de crédito',
        );
      if (doc.tipoDte === 61)
        throw new BadRequestException(
          'No se puede aplicar una nota de crédito a otra',
        );
      if (
        nota.direccion !== doc.direccion ||
        nota.rutContraparte !== doc.rutContraparte
      ) {
        throw new BadRequestException(
          'La nota de crédito y el documento deben ser del mismo cliente/proveedor',
        );
      }
      const maximo = Math.min(nota.saldoPendiente, doc.saldoPendiente);
      const monto = dto.monto ?? maximo;
      if (maximo <= 0 || monto > maximo) {
        throw new BadRequestException(
          `Se puede aplicar como máximo $${maximo}`,
        );
      }
      const [fila]: { id: number }[] = await em.query(
        `INSERT INTO nota_credito_aplicacion (empresa_id, nota_credito_id, documento_id, monto, origen, creado_por)
         VALUES ($1, $2, $3, $4, 'manual', $5) RETURNING id`,
        [empresaId, notaId, doc.id, monto, usuario.id],
      );
      await recalcular(em, { documentos: [notaId, doc.id] });
      await auditar(em, {
        empresaId,
        usuarioId: usuario.id,
        accion: 'nota_credito.aplicar',
        entidad: 'nota_credito_aplicacion',
        entidadId: fila.id,
        detalle: { notaCreditoId: notaId, documentoId: doc.id, monto },
      });
      return { id: fila.id, notaCreditoId: notaId, documentoId: doc.id, monto };
    });
  }

  async deshacerNotaCredito(
    empresaId: number,
    aplicacionId: number,
    usuario: UsuarioActual,
  ) {
    return this.ds.transaction(async (em) => {
      const [apl] = await actualizarDevolviendo<{ nc: number; doc: number }>(
        em,
        `UPDATE nota_credito_aplicacion SET deshecha_en = now(), deshecha_por = $3
          WHERE id = $1 AND empresa_id = $2 AND deshecha_en IS NULL
          RETURNING nota_credito_id::float8 AS nc, documento_id::float8 AS doc`,
        [aplicacionId, empresaId, usuario.id],
      );
      if (!apl)
        throw new NotFoundException('Aplicación no encontrada o ya deshecha');
      await recalcular(em, { documentos: [apl.nc, apl.doc] });
      await auditar(em, {
        empresaId,
        usuarioId: usuario.id,
        accion: 'nota_credito.deshacer',
        entidad: 'nota_credito_aplicacion',
        entidadId: aplicacionId,
      });
      return { ok: true };
    });
  }
}

@Controller('empresas/:empresaId')
export class DocumentosController {
  constructor(private readonly servicio: DocumentosService) {}

  @Get('documentos')
  listar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroDocumentosDto,
  ) {
    return this.servicio.listar(empresaId, filtro);
  }

  @Get('documentos/:id')
  detalle(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.servicio.detalle(empresaId, id);
  }

  @Post('documentos/:id/aplicar-nota-credito')
  @RolMinimo('operador')
  aplicarNotaCredito(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AplicarNotaCreditoDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.aplicarNotaCredito(empresaId, id, dto, usuario);
  }

  @Delete('notas-credito-aplicaciones/:id')
  @RolMinimo('operador')
  deshacerNotaCredito(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.deshacerNotaCredito(empresaId, id, usuario);
  }
}

@Module({ controllers: [DocumentosController], providers: [DocumentosService] })
export class DocumentosModule {}
