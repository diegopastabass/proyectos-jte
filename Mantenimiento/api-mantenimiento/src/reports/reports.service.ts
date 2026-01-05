import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  // 1. Guardar Reporte
  async create(createReportDto: CreateReportDto, userId: string): Promise<Report> {
    const report = this.reportRepository.create({
      ...createReportDto,
      user: { id: userId }, // Relación con el usuario
    });
    return this.reportRepository.save(report);
  }

  // 2. Consultar Reportes (Lista Resumida)
  // Ideal para el Admin dashboard. No traemos el JSON pesado.
  async findAll() {
    return this.reportRepository.find({
      select: ['id', 'ticketNumber', 'clientName', 'status', 'createdAt'],
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  // 3. Consultar un Reporte (Detalle completo con JSON)
  async findOne(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!report) throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    return report;
  }
}