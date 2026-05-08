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
    // Se hace aquí para evitar la verificación en cada request.
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
    try {
      // 1. Persistir las imágenes en disco y obtener sus rutas relativas
      const imagePaths = this.saveImages(files);

      // 2. Excluir ticketNumber del DTO (es autogenerado por la DB)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ticketNumber, ...reportData } = createReportDto as any;

      // 3. Crear la entidad con las rutas de imágenes incluidas
      const report = this.reportRepository.create({
        ...reportData,
        images: imagePaths,
        user: { id: userId },
      } as DeepPartial<Report>);

      const savedReport = await this.reportRepository.save(report);

      // 4. Actualizar el número de OT dentro del campo data.ticket
      const generatedOT = savedReport.ticketNumber.toString();
      savedReport.data = {
        ...savedReport.data,
        ticket: { ...savedReport.data?.ticket, number: generatedOT },
      };

      return await this.reportRepository.save(savedReport);
    } catch (error) {
      console.error('Error creando el reporte:', error);
      throw error;
    }
  }

  async findAll() {
    return this.reportRepository.find({
      select: ['id', 'ticketNumber', 'clientName', 'status', 'createdAt'],
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!report) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    return report;
  }

  async update(id: string, updateReportDto: UpdateReportDto): Promise<Report> {
    try {
      const report = await this.findOne(id);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, ticketNumber: __, data, ...rest } = updateReportDto as any;

      this.reportRepository.merge(report, rest);

      if (data) {
        report.data = { ...report.data, ...data };
        report.clientName = data.client?.name || report.clientName;
        report.status = data.status || report.status;
      }

      return await this.reportRepository.save(report);
    } catch (error) {
      console.error('Error detallado actualizando reporte:', error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.reportRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`No se pudo eliminar el reporte ${id}`);
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
      mkdirSync(this.UPLOAD_DIR, { recursive: true });
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
      } catch (err) {
        console.error(`Error guardando imagen ${filename}:`, err);
        throw new InternalServerErrorException(
          `No se pudo guardar la imagen: ${file.originalname}`,
        );
      }

      // Retornar ruta relativa con separador '/' para que sea
      // independiente del sistema operativo (Windows usa '\').
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
