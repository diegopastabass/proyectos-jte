import { Controller, Get, Post, Body, Param, UseGuards, Request, UseInterceptors, UploadedFiles, BadRequestException, Delete } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@UseGuards(JwtAuthGuard)
@Controller('checklists')
export class ChecklistsController {
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
  create(@Request() req, @Body('data') data: string, @UploadedFiles() files: Express.Multer.File[]) {
    if (!data) {
      throw new BadRequestException('Checklist data is required');
    }
    let createChecklistDto: CreateChecklistDto;
    try {
      createChecklistDto = JSON.parse(data);
    } catch (e) {
      throw new BadRequestException('Invalid JSON data');
    }
    return this.checklistsService.create(req.user.userId, createChecklistDto, files);
  }

  @Get()
  findAll(@Request() req) {
    return this.checklistsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.checklistsService.findOne(id, req.user);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.checklistsService.remove(id, req.user);
  }
}
