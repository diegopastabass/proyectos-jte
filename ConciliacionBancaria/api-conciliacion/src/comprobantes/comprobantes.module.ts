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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { memoryStorage } from 'multer';
import { resolve, sep } from 'path';
import { DataSource } from 'typeorm';
import {
  RolMinimo,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import { actualizarDevolviendo, auditar } from '../common/auditoria';
import { normalizarRut } from '../common/rut';
import {
  ConciliacionModule,
  ConciliacionService,
} from '../conciliacion/conciliacion.module';
import { Comprobante, Movimiento, type TipoComprobante } from '../entities';
import {
  detectarTipoArchivo,
  FORMATOS,
  tipoPorExtension,
} from './tipo-archivo';

const MAX_BYTES = 10 * 1024 * 1024;
const TASA_IVA = 0.19;

/**
 * Carpeta de las imágenes. En producción (VPS Windows):
 * C:\Users\Administrator\Pictures\umploads_consolidacion
 */
function carpetaComprobantes(): string {
  return resolve(process.env.COMPROBANTES_DIR || 'datos/comprobantes');
}

/** IVA incluido en un total con IVA (boleta o factura afecta): total − total / 1,19. */
export function ivaIncluido(total: number): number {
  return Math.round(total - total / (1 + TASA_IVA));
}

class SubirComprobanteDto {
  @IsIn(['boleta', 'factura', 'otro']) tipo: TipoComprobante;
  @Type(() => Number) @IsInt() @Min(1) montoTotal: number;
  /** Si se omite: IVA incluido para boleta y factura, 0 para "otro". */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) montoIva?: number;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsString() @MaxLength(20) rutEmisor?: string;
  @IsOptional() @IsString() @MaxLength(200) razonSocial?: string;
  @IsOptional() @IsString() @MaxLength(40) folio?: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
  /**
   * Consolidar: además de guardar el respaldo, concilia el movimiento contra esta categoría
   * por el monto del comprobante (o lo que le quede al movimiento, si es menos).
   */
  @IsOptional() @Type(() => Number) @IsInt() categoriaId?: number;
}

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly conciliacion: ConciliacionService,
  ) {}

  async subir(
    empresaId: number,
    movimientoId: number,
    archivo: { originalname: string; buffer: Buffer },
    dto: SubirComprobanteDto,
    usuario: UsuarioActual,
  ) {
    const tipoArchivo = detectarTipoArchivo(archivo.buffer);
    if (!tipoArchivo)
      throw new BadRequestException(
        'El archivo debe ser una foto (JPG, PNG, WebP, HEIC) o un PDF',
      );
    const montoIva =
      dto.montoIva ?? (dto.tipo === 'otro' ? 0 : ivaIncluido(dto.montoTotal));
    if (montoIva > dto.montoTotal)
      throw new BadRequestException('El IVA no puede ser mayor que el total');
    let rutEmisor: string | null = null;
    if (dto.rutEmisor?.trim()) {
      rutEmisor = normalizarRut(dto.rutEmisor);
      if (!rutEmisor) throw new BadRequestException('RUT del emisor inválido');
    }

    // La imagen se escribe antes de la transacción; si esta falla, se borra.
    const carpeta = carpetaComprobantes();
    const archivoId = randomUUID();
    const destino = resolve(carpeta, `${archivoId}.${FORMATOS[tipoArchivo]}`);
    await mkdir(carpeta, { recursive: true });
    await writeFile(destino, archivo.buffer, { flag: 'wx' });

    try {
      return await this.ds.transaction(async (em) => {
        const mov = await em.findOne(Movimiento, {
          where: { id: movimientoId, empresaId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!mov) throw new NotFoundException('Movimiento no encontrado');

        let conciliacionId: number | null = null;
        if (dto.categoriaId !== undefined) {
          const disponible = Math.abs(mov.monto) - mov.montoConciliado;
          if (mov.ignorado || disponible <= 0)
            throw new BadRequestException(
              'El movimiento ya no tiene saldo por conciliar: suba el comprobante sin categoría',
            );
          const c = await this.conciliacion.crearEn(
            em,
            empresaId,
            {
              lineas: [
                {
                  movimientoId,
                  categoriaId: dto.categoriaId,
                  monto: Math.min(dto.montoTotal, disponible),
                },
              ],
              nota: `Respaldado con ${dto.tipo}${dto.folio ? ` N° ${dto.folio}` : ''}`,
            },
            { usuarioId: usuario.id, origen: 'manual' },
          );
          conciliacionId = c!.id;
        }

        const comprobante = await em.save(
          em.create(Comprobante, {
            empresaId,
            movimientoId,
            tipo: dto.tipo,
            fecha: dto.fecha ?? null,
            montoTotal: dto.montoTotal,
            montoIva,
            rutEmisor,
            razonSocial: dto.razonSocial?.trim() || null,
            folio: dto.folio?.trim() || null,
            descripcion: dto.descripcion?.trim() || null,
            archivoId,
            archivoRuta: destino,
            conciliacionId,
            creadoPor: usuario.id,
          }),
        );
        await auditar(em, {
          empresaId,
          usuarioId: usuario.id,
          accion: 'comprobante.crear',
          entidad: 'comprobante',
          entidadId: comprobante.id,
          detalle: {
            movimientoId,
            conciliacionId,
            archivoId,
            archivoOriginal: archivo.originalname,
            ...dto,
          },
        });
        return em.findOneBy(Comprobante, { id: comprobante.id });
      });
    } catch (e) {
      await unlink(destino).catch(() => undefined);
      throw e;
    }
  }

  async archivo(empresaId: number, id: number) {
    const c = await this.ds
      .getRepository(Comprobante)
      .createQueryBuilder('c')
      .addSelect('c.archivoRuta')
      .where('c.id = :id AND c.empresaId = :empresaId', { id, empresaId })
      .getOne();
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    // La ruta la escribió la API, pero igual se exige que esté dentro de la carpeta configurada.
    const ruta = resolve(c.archivoRuta);
    const tipo = tipoPorExtension(ruta);
    if (!ruta.startsWith(carpetaComprobantes() + sep) || !tipo)
      throw new NotFoundException('Archivo del comprobante no disponible');
    const nombre = ruta.slice(ruta.lastIndexOf(sep) + 1);
    return { ruta, tipo, nombre };
  }

  /**
   * Lo marca como eliminado (el archivo se conserva, por trazabilidad). Si al subirlo se
   * concilió el movimiento, esa conciliación sigue vigente: se deshace aparte.
   */
  async eliminar(empresaId: number, id: number, usuario: UsuarioActual) {
    return this.ds.transaction(async (em) => {
      const [fila] = await actualizarDevolviendo<{ id: string }>(
        em,
        `UPDATE comprobante SET eliminado_en = now(), eliminado_por = $3
          WHERE id = $1 AND empresa_id = $2 AND eliminado_en IS NULL RETURNING id`,
        [id, empresaId, usuario.id],
      );
      if (!fila) throw new NotFoundException('Comprobante no encontrado');
      await auditar(em, {
        empresaId,
        usuarioId: usuario.id,
        accion: 'comprobante.eliminar',
        entidad: 'comprobante',
        entidadId: id,
      });
    });
  }
}

@Controller('empresas/:empresaId')
export class ComprobantesController {
  constructor(private readonly servicio: ComprobantesService) {}

  /**
   * multipart/form-data: campo "archivo" (foto o PDF) + los datos del comprobante.
   * Con `categoriaId` además concilia el movimiento (consolidar el gasto con su boleta).
   */
  @Post('movimientos/:movimientoId/comprobantes')
  @RolMinimo('operador')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
    }),
  )
  subir(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('movimientoId', ParseIntPipe) movimientoId: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: SubirComprobanteDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    if (!archivo)
      throw new BadRequestException('Falta el archivo (campo "archivo")');
    // multer entrega el nombre en latin1; se corrige para nombres con tildes.
    const originalname = Buffer.from(archivo.originalname, 'latin1').toString(
      'utf8',
    );
    return this.servicio.subir(
      empresaId,
      movimientoId,
      { originalname, buffer: archivo.buffer },
      dto,
      usuario,
    );
  }

  @Get('comprobantes/:id/archivo')
  async archivo(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = await this.servicio.archivo(empresaId, id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return new StreamableFile(createReadStream(a.ruta), {
      type: a.tipo,
      disposition: `inline; filename="${a.nombre}"`,
    });
  }

  @Delete('comprobantes/:id')
  @RolMinimo('operador')
  eliminar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.eliminar(empresaId, id, usuario);
  }
}

@Module({
  imports: [ConciliacionModule],
  controllers: [ComprobantesController],
  providers: [ComprobantesService],
})
export class ComprobantesModule {}
