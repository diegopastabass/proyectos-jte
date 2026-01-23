import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Res,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { type Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';
import { diskStorage } from 'multer';
import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import * as path from 'path';

@Controller('sessions/app/')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async create(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('data') dataString: string,
  ) {
    if (!dataString) throw new BadRequestException('Faltan datos de la sesión');

    const sessionData = JSON.parse(dataString);

    return this.sessionsService.createFullSession(sessionData, files);
  }

  @Get('report/:id')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const reportData = await this.sessionsService.getReportData(id);

    const fonts = {
      Roboto: {
        normal: path.join(__dirname, '../../assets/fonts/Roboto-Regular.ttf'),
        bold: path.join(__dirname, '../../assets/fonts/Roboto-Medium.ttf'),
        italics: path.join(__dirname, '../../assets/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(
          __dirname,
          '../../assets/fonts/Roboto-MediumItalic.ttf',
        ),
      },
    };

    const printer = new PdfPrinter({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: 'Informe de Medición - Ranguil', style: 'header' },
        {
          columns: [
            {
              width: '*',
              text: `Técnico: ${reportData.header.technicianName}`,
              style: 'subheader',
            },
            {
              width: '*',
              text: `Fecha: ${new Date(reportData.header.date).toLocaleDateString()}`,
              style: 'subheader',
              alignment: 'right',
            },
          ],
        },
        { text: '\n\n' }, // Espacio
        // Tabla de mediciones
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Ítem', style: 'tableHeader' },
                { text: 'Valor', style: 'tableHeader' },
                { text: 'Ubicación', style: 'tableHeader' },
                { text: 'Evidencia', style: 'tableHeader' },
              ],
              ...reportData.items.map((item) => {
                // Fila de datos
                return [
                  item.label,
                  `${item.value} ${item.unit || ''}`,
                  item.location || '-',
                  item.image
                    ? {
                        text: 'Ver Foto',
                        link: `https://app.jteanalytics.cl/ranguil-mediciones/uploads/${item.image}`,
                        color: 'blue',
                        decoration: 'underline',
                      }
                    : 'Sin foto',
                ];

                // NOTA: Si quisieras incrustar la imagen en el PDF (base64 o path local),
                // necesitarías leer el archivo del disco aquí:
                // image: path.join(__dirname, '../../uploads', item.image), width: 100
              }),
            ],
          },
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] },
        tableHeader: { bold: true, fontSize: 13, color: 'black' },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=reporte_${id}.pdf`,
    );

    pdfDoc.pipe(res);
    pdfDoc.end();
  }

  @Get()
  findAll() {
    return this.sessionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sessionsService.remove(id);
  }
}
