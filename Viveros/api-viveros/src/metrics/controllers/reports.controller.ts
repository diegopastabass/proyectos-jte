import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from '../services/reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/weekly
   * Genera y descarga el informe semanal en PDF.
   */
  @Get('weekly')
  async downloadWeeklyReport(@Res() res: Response) {
    const buffer = await this.reportsService.generateWeeklyReport();

    const fileName = `informe-semanal-viveros-${new Date().toISOString().split('T')[0]}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
