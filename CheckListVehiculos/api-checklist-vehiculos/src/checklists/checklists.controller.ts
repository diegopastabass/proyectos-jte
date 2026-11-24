import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFiles,
  BadRequestException, Delete, Logger, ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { QueryChecklistsDto } from './dto/query-checklists.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@UseGuards(JwtAuthGuard)
@Controller('checklists')
export class ChecklistsController {
  private readonly logger = new Logger(ChecklistsController.name);

  constructor(private readonly checklistsService: ChecklistsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 26, {
    storage: diskStorage({
      destination: './uploads',
      // El nombre y la extensión los decide el servidor, nunca el cliente
      filename: (_req, file, callback) => callback(null, `${randomUUID()}${ALLOWED_MIME[file.mimetype] ?? '.jpg'}`),
    }),
    fileFilter: (_req, file, callback) => {
      if (ALLOWED_MIME[file.mimetype]) return callback(null, true);
      callback(new BadRequestException('Solo se permiten imágenes JPG, PNG o WebP'), false);
    },
    limits: {
      fieldSize: 1 * 1024 * 1024, // el campo "data" es solo texto
      fileSize: 5 * 1024 * 1024,
    },
  }))
  async create(@Request() req, @Body('data') data: string, @UploadedFiles() files: Express.Multer.File[] = []) {
    try {
      if (!data) {
        throw new BadRequestException('Checklist data is required');
      }
      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch {
        throw new BadRequestException('Invalid JSON data');
      }
      // ValidationPipe no actúa sobre un JSON dentro de un campo multipart: se valida aquí
      const dto = plainToInstance(CreateChecklistDto, json);
      const errors = await validate(dto, { whitelist: true, forbidUnknownValues: true });
      if (errors.length) {
        throw new BadRequestException(errors.flatMap(e => Object.values(e.constraints ?? {})));
      }
      return await this.checklistsService.create(req.user.userId, dto, files);
    } catch (error) {
      // Si algo falla, las fotos ya escritas por Multer no deben quedar huérfanas
      await Promise.all((files ?? []).map(f => unlink(f.path).catch(() => undefined)));
      this.logger.error(`Error creating checklist: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get()
  async findAll(@Request() req, @Query() query: QueryChecklistsDto) {
    return this.checklistsService.findAll(req.user, query);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.checklistsService.findOne(String(id), req.user);
  }

  @UseGuards(RolesGuard)
  @Roles(true) // los checklists son registro de auditoría: solo un administrador los elimina
  @Delete(':id')
  async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.checklistsService.remove(String(id), req.user);
  }
}
