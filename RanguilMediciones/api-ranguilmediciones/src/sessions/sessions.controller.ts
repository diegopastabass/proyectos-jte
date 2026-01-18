import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

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
    if (!dataString) throw new BadRequestException('Faltan datos de la sesión');

    const sessionData = JSON.parse(dataString);

    return this.sessionsService.createFullSession(sessionData, files);
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
