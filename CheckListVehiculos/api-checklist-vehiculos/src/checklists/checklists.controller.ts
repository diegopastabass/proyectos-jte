import { Controller, Get, Post, Body, Param, UseGuards, Request, UseInterceptors, UploadedFiles, BadRequestException, Delete, Logger } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@UseGuards(JwtAuthGuard)
@Controller('checklists')
export class ChecklistsController {
  private readonly logger = new Logger(ChecklistsController.name);

  constructor(private readonly checklistsService: ChecklistsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  async create(@Request() req, @Body('data') data: string, @UploadedFiles() files: Express.Multer.File[]) {
    try {
      if (!data) {
        throw new BadRequestException('Checklist data is required');
      }
      let createChecklistDto: CreateChecklistDto;
      try {
        createChecklistDto = JSON.parse(data);
      } catch (e) {
        throw new BadRequestException('Invalid JSON data');
      }
      return await this.checklistsService.create(req.user.userId, createChecklistDto, files);
    } catch (error) {
      this.logger.error(`Error creating checklist: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get()
  async findAll(@Request() req) {
    try {
      return await this.checklistsService.findAll(req.user);
    } catch (error) {
      this.logger.error(`Error finding all checklists: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    try {
      return await this.checklistsService.findOne(id, req.user);
    } catch (error) {
      this.logger.error(`Error finding checklist ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    try {
      return await this.checklistsService.remove(id, req.user);
    } catch (error) {
      this.logger.error(`Error removing checklist ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
