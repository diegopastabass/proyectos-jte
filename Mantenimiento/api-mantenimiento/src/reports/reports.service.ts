import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Report } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async create(createReportDto: CreateReportDto, userId: string): Promise<Report> {
    try {
      // Tu código actual...
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ticketNumber, ...reportData } = createReportDto as any;
      
      const report = this.reportRepository.create({
        ...reportData,
        user: { id: userId },
      } as DeepPartial<Report>);
  
      const savedReport = await this.reportRepository.save(report);
  
      // ... resto de tu lógica
      const generatedOT = savedReport.ticketNumber.toString();
      savedReport.data = {
        ...savedReport.data,
        ticket: { ...savedReport.data.ticket, number: generatedOT }
      };
      
      return await this.reportRepository.save(savedReport);

    } catch (error) {
      // ESTO IMPRIMIRÁ EL ERROR REAL EN TU TERMINAL
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

    if (!report) throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
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
}