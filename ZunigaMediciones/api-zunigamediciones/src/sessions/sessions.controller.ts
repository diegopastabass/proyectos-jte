import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Param,
  Body,
  Res,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Logger,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { type Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('sessions/')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  @Get('app/uploads/:filename')
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.sessionsService.getStaticFile(filename);
    res.sendFile(filePath);
  }

  @Get('export')
  async getExportData(
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!start || !end) {
      throw new BadRequestException('Debe proporcionar start y end dates');
    }
    return this.sessionsService.findMeasurementsByRange(start, end);
  }

  @Post('app/')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async create(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('data') dataString: string,
  ) {
    this.logger.log(`Creando sesión con datos: ${dataString}`);
    if (!dataString) throw new BadRequestException('Faltan datos de la sesión');
    const sessionData = JSON.parse(dataString);
    return this.sessionsService.createFullSession(sessionData, files);
  }

  @Get('app/')
  findAll() {
    return this.sessionsService.findAll();
  }

  @Get('app/:id')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Delete('app/:id')
  remove(@Param('id') id: string) {
    return this.sessionsService.remove(id);
  }

  @Patch('app/:id')
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('data') dataString: string,
  ) {
    this.logger.log(`Actualizando sesión ${id} con datos: ${dataString}`);
    if (!dataString)
      throw new BadRequestException('Faltan datos de la actualización');
    const sessionData = JSON.parse(dataString);
    return this.sessionsService.updateSession(id, sessionData, files);
  }

  @Get('app/report/:id')
  async getReportData(@Param('id') id: string) {
    this.logger.log(`Solicitando datos JSON de reporte ID: ${id}`);
    const data = await this.sessionsService.getReportData(id);
    if (!data) throw new NotFoundException('Datos no encontrados');
    return data;
  }
}
