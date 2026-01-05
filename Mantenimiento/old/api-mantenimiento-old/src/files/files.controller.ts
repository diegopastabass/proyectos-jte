// files.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { CreateFileDto } from './create-file.dto';
import { File } from './files.entity';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'maintainer') // Assuming you have a Roles decorator and guard set up
  @Post()
  async createFile(@Body() createFileDto: CreateFileDto): Promise<File> {
    return this.filesService.createFile(createFileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':maintenanceId')
  async findFileByMaintenanceId(
    @Param('maintenanceId', ParseIntPipe) maintenanceId: number,
  ) {
    const file = await this.filesService.findFileByMaintenanceId(maintenanceId);
    if (!file) {
      return {
        success: false,
        message: 'File not found for this maintenance session',
      };
    }
    return { success: true, data: file };
  }
}
