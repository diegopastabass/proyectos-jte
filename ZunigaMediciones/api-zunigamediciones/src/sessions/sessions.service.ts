import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Session } from './entities/session.entity';
import { Measurement } from './entities/measurement.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { User } from '../users/entities/user.entity';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly dataSource: DataSource,
  ) {}

  getStaticFile(filename: string): string {
    // Construimos la ruta absoluta: Root del proyecto + uploads + nombre archivo
    const filePath = join(process.cwd(), 'uploads', filename);

    // Validación de seguridad básica para evitar Path Traversal (../)
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new BadRequestException('Nombre de archivo inválido');
    }

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `La imagen ${filename} no existe en el servidor`,
      );
    }

    return filePath;
  }

  async createFullSession(
    data: CreateSessionDto,
    files: Array<Express.Multer.File>,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Rescatar el nombre del técnico desde la metadata
      const technicianName = data.reportMetadata?.generatedBy;

      if (!technicianName) {
        throw new BadRequestException(
          'No se encontró el nombre del técnico (generatedBy) en la metadata.',
        );
      }

      // 2. Buscar al usuario por su nombre exacto
      const user = await queryRunner.manager.findOne(User, {
        where: { name: technicianName },
      });

      if (!user) {
        throw new BadRequestException(
          `El usuario con nombre "${technicianName}" no existe en el sistema.`,
        );
      }

      const measurementsToSave: Measurement[] = data.measurements.map(
        (item, index) => {
          const measure = new Measurement();
          measure.name = item.name;
          measure.value = Number(item.value);
          measure.time = new Date(item.time);
          measure.location = item.location || '';

          if (files && files[index]) {
            measure.imagePath = files[index].filename;
          }

          return measure;
        },
      );

      const reportSnapshot = {
        header: {
          sessionId: null,
          date: new Date().toISOString(),
          technicianName: user.name,
          technicianEmail: user.email,
        },
        items: measurementsToSave.map((m) => ({
          label: m.name,
          value: m.value,
          unit: this.getUnit(m.name),
          location: m.location,
          time: m.time,
          image: m.imagePath,
        })),
        metadata: data.reportMetadata,
      };

      const newSession = new Session();
      newSession.user = user;
      newSession.measures_number = data.measurements.length;
      newSession.report_json = reportSnapshot;
      newSession.state = '0'; // Sesión incompleta: falta medición de cloro tarde

      const savedSession = await queryRunner.manager.save(newSession);

      savedSession.report_json['header']['sessionId'] = savedSession.id;
      await queryRunner.manager.save(savedSession);

      measurementsToSave.forEach((m) => (m.session = savedSession));
      await queryRunner.manager.save(measurementsToSave);

      await queryRunner.commitTransaction();

      return {
        message: 'Sesión creada exitosamente',
        sessionId: savedSession.id,
        state: savedSession.state,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Error Transaction:', err);
      throw new BadRequestException(
        'Error al guardar la sesión: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateSession(
    id: string,
    data: UpdateSessionDto,
    files: Array<Express.Multer.File>,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar la sesión existente
      const session = await queryRunner.manager.findOne(Session, {
        where: { id },
        relations: ['user'],
      });

      if (!session) {
        throw new NotFoundException(`Sesión con id "${id}" no encontrada.`);
      }

      if (session.state === '1') {
        throw new BadRequestException(
          'Esta sesión ya está completa y no puede ser modificada.',
        );
      }

      if (session.update_count >= 3) {
        throw new BadRequestException(
          'Esta sesión ya alcanzó el máximo de 3 actualizaciones permitidas.',
        );
      }

      // 2. Crear las nuevas mediciones con timestamp propio
      const now = new Date();
      const newMeasures: Measurement[] = (data.measurements || []).map(
        (item, index) => {
          const m = new Measurement();
          m.name = item.name;
          m.value = Number(item.value);
          m.time = now;
          m.location = item.location || '';
          m.session = session;
          if (files && files[index]) {
            m.imagePath = files[index].filename;
          }
          return m;
        },
      );

      await queryRunner.manager.save(newMeasures);

      // 3. Actualizar el report_json
      const updatedReportJson = { ...session.report_json };
      updatedReportJson.items = [
        ...(updatedReportJson.items || []),
        ...newMeasures.map((m) => ({
          label: m.name,
          value: m.value,
          unit: this.getUnit(m.name),
          location: m.location,
          time: m.time,
          image: m.imagePath,
        })),
      ];

      // 4. Actualizar contadores y estado
      session.measures_number = session.measures_number + newMeasures.length;
      session.report_json = updatedReportJson;
      session.update_count = (session.update_count || 0) + 1;

      // Marcar completa si: usuario lo pide explícitamente O se alcanzó el límite de 3 ediciones
      if (data.markComplete === true || session.update_count >= 3) {
        session.state = '1';
      }

      await queryRunner.manager.save(session);
      await queryRunner.commitTransaction();

      return {
        message: 'Sesión actualizada con nuevas mediciones de cloro.',
        sessionId: session.id,
        state: session.state,
        update_count: session.update_count,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Error Transaction updateSession:', err);
      throw new BadRequestException(
        'Error al actualizar la sesión: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findMeasurementsByRange(startDate: string, endDate: string) {
    const start = new Date(`${startDate} 00:00:00`);
    console.log(start);
    const end = new Date(`${endDate} 23:59:59`);
    console.log(end);

    return this.dataSource.getRepository(Measurement).find({
      where: {
        time: Between(start, end),
      },
      order: {
        time: 'ASC',
      },
      relations: ['session', 'session.user'],
    });
  }

  private getUnit(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('cloro')) return 'ppm';
    if (lower.includes('caudal')) return 'm³';
    if (lower.includes('energía') || lower.includes('kwh')) return 'kWh';
    if (lower.includes('horómetro')) return 'Hrs';
    return '';
  }

  async findAll() {
    const CHLORO_LABELS = [
      'Cloro en Caseta',
      'Cloro Red Punto 1',
      'Cloro Red Punto 2',
    ];

    const sessions = await this.sessionRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        createdAt: true,
        measures_number: true,
        state: true,
        update_count: true,
        report_json: true,
        user: {
          name: true,
          email: true,
        },
      },
    });

    return sessions.map((s) => {
      const presentLabels: string[] = (
        (s.report_json?.items as any[]) || []
      ).map((item: any) => item.label as string);

      const chloro_pending_count = CHLORO_LABELS.filter(
        (label) => !presentLabels.includes(label),
      ).length;

      // Omitir report_json del resultado para no sobrecargar la respuesta
      const { report_json, ...rest } = s as any;
      return { ...rest, chloro_pending_count };
    });
  }

  async getReportData(id: string) {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    // Si existe el snapshot JSON, lo usamos. Si no, lo construimos al vuelo (retrocompatibilidad)
    if (session.report_json && session.report_json.items) {
      return session.report_json;
    }

    // Fallback: Si es una sesión antigua sin JSON rico, retornamos algo básico
    return {
      header: {
        date: session.createdAt,
        technicianName: session.user?.name,
      },
      items: [],
    };
  }

  async findOne(id: string) {
    return this.sessionRepo.findOne({
      where: { id },
      relations: ['measurements', 'user'],
      order: {
        measurements: {
          time: 'ASC',
        },
      },
    });
  }

  async remove(id: string) {
    return this.sessionRepo.delete(id);
  }
}
