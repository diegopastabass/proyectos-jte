import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from '../services/reports.service';
import { RangoOpcionalDto } from '../models/dto/viveros.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/weekly[?start&end]
   * Informe en PDF. Sin rango, la semana anterior completa (lunes a domingo).
   */
  @Get('weekly')
  async downloadWeeklyReport(@Query() q: RangoOpcionalDto, @Res() res: Response) {
    const { buffer, periodo } = await this.reportsService.generar(q);
    const fileName = `viveros_informe_${periodo.start}_${periodo.end}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    res.end(buffer);
  }
}
