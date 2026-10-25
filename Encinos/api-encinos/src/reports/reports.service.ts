import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EncinosReport } from './models/reports.entity';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(EncinosReport)
    private repo: Repository<EncinosReport>,
  ) {}

  async create(dto: CreateReportDto): Promise<EncinosReport> {
    const report = this.repo.create(dto);
    return await this.repo.save(report);
  }

  async update(id: number, dto: Partial<CreateReportDto>): Promise<EncinosReport | null> {
    await this.repo.update(id, dto);
    return this.repo.findOneBy({ id });
  }

  async findAll(dto: DateRangeDto): Promise<EncinosReport[]> {
    if (!dto.start || !dto.end) {
      // Si no hay rango, devolvemos los últimos 100 por defecto
      return this.repo.find({
        order: { time: 'DESC' },
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
