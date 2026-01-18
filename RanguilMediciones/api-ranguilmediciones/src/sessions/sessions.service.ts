import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Session } from './entities/session.entity';
import { Measurement } from './entities/measurement.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly dataSource: DataSource,
  ) {}

  async createFullSession(
    data: CreateSessionDto,
    files: Array<Express.Multer.File>,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = new User();
      user.id = data.userId;

      const newSession = new Session();
      newSession.user = user;
      newSession.measures_number = data.measurements.length;
      newSession.report_json = data.reportMetadata || {};

      const savedSession = await queryRunner.manager.save(newSession);

      const measurementsToSave = data.measurements.map((item, index) => {
        const measure = new Measurement();
        measure.session = savedSession;
        measure.name = item.name;
        measure.value = Number(item.value);
        measure.time = new Date(item.time);
        measure.location = item.location || '';

        if (files && files[index]) {
          measure.imagePath = files[index].filename;
        }

        return measure;
      });

      await queryRunner.manager.save(measurementsToSave);

      await queryRunner.commitTransaction();
      return {
        message: 'Sesión creada exitosamente',
        sessionId: savedSession.id,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Error al guardar la sesión: ' + err.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.sessionRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        createdAt: true,
        measures_number: true,
        user: {
          name: true,
          email: true,
        },
      },
    });
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
