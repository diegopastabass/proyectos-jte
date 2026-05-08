import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

// Constantes de configuración de Multer centralizadas
const MULTER_IMAGE_CONFIG = {
  storage: memoryStorage(), // Buffer en memoria; el servicio escribe al disco
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB por imagen
    files: 10, // Máximo 10 imágenes por reporte
  },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          `Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan imágenes.`,
        ),
        false,
      );
    }
  },
};

@Controller('app/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images', 10, MULTER_IMAGE_CONFIG))
  async create(
    @Body() createReportDto: CreateReportDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? req.body?.userId;
    return this.reportsService.create(createReportDto, userId, files ?? []);
  }

  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReportDto: UpdateReportDto,
  ) {
    return this.reportsService.update(id, updateReportDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.remove(id);
  }
}
