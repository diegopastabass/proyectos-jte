import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// Logger helper — centraliza el formato para que PM2 lo capture limpiamente
// ─────────────────────────────────────────────────────────────────────────────

function log(level: 'INFO' | 'WARN' | 'ERROR', context: string, message: string, extra?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [ReportsService.${context}] ${message}`;

  if (extra) {
    const details = JSON.stringify(extra, null, 2);
    if (level === 'ERROR') {
      console.error(`${base}\n${details}`);
    } else if (level === 'WARN') {
      console.warn(`${base}\n${details}`);
    } else {
      console.log(`${base}\n${details}`);
    }
  } else {
    if (level === 'ERROR') {
      console.error(base);
    } else if (level === 'WARN') {
      console.warn(base);
    } else {
      console.log(base);
    }
  }
}

function logError(context: string, message: string, error: unknown): void {
  const err = error as any;
  log('ERROR', context, message, {
    errorMessage: err?.message ?? String(error),
    errorName: err?.name,
    errorCode: err?.code,
    errorDetail: err?.detail,        // PostgreSQL: detalle del constraint violado
    errorHint: err?.hint,            // PostgreSQL: sugerencia
    errorTable: err?.table,          // PostgreSQL: tabla involucrada
    errorColumn: err?.column,        // PostgreSQL: columna involucrada
    stack: err?.stack,
  });
}

@Injectable()
export class ReportsService {
  /**
   * Directorio base donde se almacenan las imágenes de reportes.
   * Ruta relativa al CWD del proceso (compatible con Windows y Linux).
   */
  private readonly UPLOAD_DIR = join(process.cwd(), 'uploads', 'reports');

  /**
   * Prefijo de ruta pública que se almacena en la base de datos.
   * Debe coincidir con la ruta que expone el servidor de archivos estáticos.
   */
  private readonly PUBLIC_PATH_PREFIX = '/uploads/reports';

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {
    // Garantizar que el directorio exista al inicializar el servicio.
    this.ensureUploadDirExists();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  async create(
    createReportDto: CreateReportDto,
    userId: string,
    files: Express.Multer.File[] = [],
  ): Promise<Report> {
    log('INFO', 'create', 'Iniciando creación de reporte', {
      userId,
      clientName: createReportDto.clientName,
      status: createReportDto.status,
      filesCount: files.length,
      createdAtRecibido: (createReportDto as any).createdAt ?? null,
    });

    try {
      // 1. Persistir imágenes en disco
      log('INFO', 'create', 'Guardando imágenes en disco', { count: files.length });
      const imagePaths = this.saveImages(files);
      log('INFO', 'create', 'Imágenes guardadas correctamente', { paths: imagePaths });

      // 2. Excluir ticketNumber del DTO (autogenerado por la DB)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ticketNumber, ...reportData } = createReportDto as any;

      // 3. Resolver fecha de creación:
      //    - Si el cliente provee una → se respeta (permite retroalimentar fechas)
      //    - Si no provee ninguna → se usa la fecha actual
      const resolvedCreatedAt: Date = reportData.createdAt
        ? new Date(reportData.createdAt)
        : new Date();

      log('INFO', 'create', 'Fecha de creación resuelta', {
        fuenteFecha: reportData.createdAt ? 'cliente' : 'servidor',
        resolvedCreatedAt: resolvedCreatedAt.toISOString(),
      });

      // 4. Construir entidad
      const report = this.reportRepository.create({
        ...reportData,
        createdAt: resolvedCreatedAt,
        images: imagePaths,
        user: { id: userId },
      } as DeepPartial<Report>);

      log('INFO', 'create', 'Ejecutando INSERT (primer save)…');
      const savedReport = await this.reportRepository.save(report);
      log('INFO', 'create', 'Primer save exitoso', {
        id: savedReport.id,
        ticketNumber: savedReport.ticketNumber,
        createdAt: savedReport.createdAt,
      });

      // 5. Actualizar data.ticket con el OT generado y la fecha resuelta.
      //    - number: OT autogenerado por la DB (secuencia)
      //    - date:   fecha que eligió el usuario (o la actual si no indicó ninguna).
      //              Se sobreescribe siempre para que el PDF muestre la fecha correcta
      //              incluso cuando el reporte fue clonado desde uno con fecha distinta.
      //    Se propaga resolvedCreatedAt también a nivel de entidad para que el UPDATE
      //    no sobreescriba el valor que se insertó en el primer save().
      const generatedOT = savedReport.ticketNumber.toString();
      const ticketDate = resolvedCreatedAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      log('INFO', 'create', `Actualizando data.ticket → OT #${generatedOT}, fecha ${ticketDate}`);
      savedReport.data = {
        ...savedReport.data,
        ticket: {
          ...savedReport.data?.ticket,
          number: generatedOT,
          date: ticketDate,
        },
      };
      savedReport.createdAt = resolvedCreatedAt;

      log('INFO', 'create', `Actualizando OT en data.ticket → OT #${generatedOT} (segundo save)…`);
      const finalReport = await this.reportRepository.save(savedReport);
      log('INFO', 'create', '✅ Reporte creado exitosamente', {
        id: finalReport.id,
        ot: finalReport.ticketNumber,
        clientName: finalReport.clientName,
        status: finalReport.status,
        createdAt: finalReport.createdAt,
      });

      return finalReport;
    } catch (error) {
      logError('create', '❌ Error al crear el reporte', error);
      throw error;
    }
  }

  async findAll() {
    log('INFO', 'findAll', 'Consultando todos los reportes');
    try {
      const reports = await this.reportRepository.find({
        select: ['id', 'ticketNumber', 'clientName', 'status', 'createdAt'],
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });
      log('INFO', 'findAll', `✅ Reportes obtenidos: ${reports.length}`);
      return reports;
    } catch (error) {
      logError('findAll', '❌ Error al consultar reportes', error);
      throw error;
    }
  }

  async findOne(id: string): Promise<Report> {
    log('INFO', 'findOne', 'Buscando reporte', { id });
    try {
      const report = await this.reportRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (!report) {
        log('WARN', 'findOne', `Reporte no encontrado`, { id });
        throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
      }

      log('INFO', 'findOne', '✅ Reporte encontrado', {
        id: report.id,
        ot: report.ticketNumber,
        clientName: report.clientName,
      });
      return report;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logError('findOne', '❌ Error al buscar reporte', error);
      throw error;
    }
  }

  async update(id: string, updateReportDto: UpdateReportDto): Promise<Report> {
    log('INFO', 'update', 'Iniciando actualización de reporte', {
      id,
      camposRecibidos: Object.keys(updateReportDto),
      createdAtRecibido: (updateReportDto as any).createdAt ?? null,
    });

    try {
      const report = await this.findOne(id);
      log('INFO', 'update', 'Reporte cargado para actualización', {
        ot: report.ticketNumber,
        clientName: report.clientName,
        createdAtActual: report.createdAt,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, ticketNumber: __, data, createdAt, ...rest } = updateReportDto as any;

      // Si el cliente envía una nueva fecha de creación, se respeta
      if (createdAt) {
        report.createdAt = new Date(createdAt);
        log('INFO', 'update', 'Fecha de creación actualizada', {
          nuevaFecha: report.createdAt.toISOString(),
        });
      }

      this.reportRepository.merge(report, rest);

      if (data) {
        report.data = { ...report.data, ...data };
        report.clientName = data.client?.name || report.clientName;
        report.status = data.status || report.status;
        log('INFO', 'update', 'Campo data fusionado', {
          clientName: report.clientName,
          status: report.status,
        });
      }

      // Si se actualizó createdAt, sincronizar también data.ticket.date para que
      // el PDF muestre la misma fecha que la almacenada en la BD.
      if (createdAt && report.data?.ticket) {
        const ticketDate = report.createdAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
        report.data = {
          ...report.data,
          ticket: { ...report.data.ticket, date: ticketDate },
        };
        log('INFO', 'update', `data.ticket.date sincronizado → ${ticketDate}`);
      }

      log('INFO', 'update', 'Ejecutando UPDATE (save)…');
      const updated = await this.reportRepository.save(report);
      log('INFO', 'update', '✅ Reporte actualizado exitosamente', {
        id: updated.id,
        ot: updated.ticketNumber,
        clientName: updated.clientName,
        status: updated.status,
        createdAt: updated.createdAt,
      });

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logError('update', `❌ Error al actualizar el reporte ID=${id}`, error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    log('INFO', 'remove', 'Eliminando reporte', { id });
    try {
      const result = await this.reportRepository.delete(id);
      if (result.affected === 0) {
        log('WARN', 'remove', 'Reporte no encontrado para eliminar', { id });
        throw new NotFoundException(`No se pudo eliminar el reporte ${id}`);
      }
      log('INFO', 'remove', '✅ Reporte eliminado', { id, affected: result.affected });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      logError('remove', `❌ Error al eliminar el reporte ID=${id}`, error);
      throw error;
    }
  }

  async getUniqueClientNames(): Promise<string[]> {
    log('INFO', 'getUniqueClientNames', 'Consultando nombres de clientes únicos');
    try {
      const results = await this.reportRepository
        .createQueryBuilder('report')
        .select('DISTINCT report.clientName', 'clientName')
        .where('report.clientName IS NOT NULL')
        .andWhere("report.clientName != ''")
        .orderBy('report.clientName', 'ASC')
        .getRawMany();

      const names = results.map((row) => row.clientName);
      log('INFO', 'getUniqueClientNames', `✅ Clientes únicos encontrados: ${names.length}`);
      return names;
    } catch (error) {
      logError('getUniqueClientNames', '❌ Error al consultar clientes únicos', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Crea el directorio de uploads si no existe.
   * Usa `recursive: true` para crear toda la cadena de directorios de una vez
   * y para que no lance error si el directorio ya existe.
   */
  private ensureUploadDirExists(): void {
    if (!existsSync(this.UPLOAD_DIR)) {
      log('INFO', 'ensureUploadDirExists', `Creando directorio de uploads: ${this.UPLOAD_DIR}`);
      mkdirSync(this.UPLOAD_DIR, { recursive: true });
      log('INFO', 'ensureUploadDirExists', 'Directorio creado correctamente');
    } else {
      log('INFO', 'ensureUploadDirExists', `Directorio de uploads ya existe: ${this.UPLOAD_DIR}`);
    }
  }

  /**
   * Persiste los archivos en disco y retorna un arreglo de rutas relativas
   * listas para almacenar en la base de datos.
   *
   * Estrategia de nombres: UUID v4 + extensión original.
   * Esto garantiza unicidad sin depender de timestamps (que pueden colisionar
   * bajo carga concurrente).
   *
   * @param files - Archivos recibidos desde Multer (memoria buffer).
   * @returns Arreglo de rutas relativas públicas, ej: ["/uploads/reports/abc.jpg"]
   */
  private saveImages(files: Express.Multer.File[]): string[] {
    if (!files || files.length === 0) return [];

    return files.map((file) => {
      const extension = this.extractExtension(file.originalname, file.mimetype);
      const filename = `${uuidv4()}.${extension}`;
      const absolutePath = join(this.UPLOAD_DIR, filename);

      try {
        writeFileSync(absolutePath, file.buffer);
        log('INFO', 'saveImages', `Imagen guardada: ${filename}`, {
          originalname: file.originalname,
          size: file.size,
        });
      } catch (err) {
        logError('saveImages', `Error guardando imagen ${filename}`, err);
        throw new InternalServerErrorException(
          `No se pudo guardar la imagen: ${file.originalname}`,
        );
      }

      return `${this.PUBLIC_PATH_PREFIX}/${filename}`;
    });
  }

  /**
   * Extrae la extensión del archivo a partir del nombre original.
   * Hace fallback al mimetype si el nombre no tiene extensión válida.
   *
   * @param originalname - Nombre original del archivo.
   * @param mimetype     - MIME type del archivo (ej: "image/jpeg").
   * @returns Extensión sin punto (ej: "jpg", "png", "webp").
   */
  private extractExtension(originalname: string, mimetype: string): string {
    const parts = originalname?.split('.');
    if (parts && parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }

    // Fallback por mimetype
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    return mimeMap[mimetype] ?? 'jpg';
  }
}
