import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CarracedoReport } from './models/reports.entity';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(CarracedoReport)
    private repo: Repository<CarracedoReport>,
  ) {}

  async create(dto: CreateReportDto): Promise<CarracedoReport> {
    const report = this.repo.create(dto);
    return await this.repo.save(report);
  }

  async findAll(dto: DateRangeDto): Promise<CarracedoReport[]> {
    if (!dto.start || !dto.end) {
      // Si no hay rango, devolvemos los últimos 100 por defecto
      return this.repo.find({
        order: { time: 'DESC' },
        take: 100,
      });
    }

    const start = new Date(`${dto.start}T00:00:00`);
    const end = new Date(`${dto.end}T23:59:59`);

    return this.repo.find({
      where: {
        time: Between(start, end),
      },
      order: { time: 'DESC' },
    });
  }
}
