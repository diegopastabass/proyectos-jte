// files.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './files.entity';
import { CreateFileDto } from './create-file.dto';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private filesRepository: Repository<File>,
  ) {}

  async createFile(createFileDto: CreateFileDto): Promise<File> {
    try {
      const file = this.filesRepository.create(createFileDto);
      return await this.filesRepository.save(file);
    } catch (error) {
      throw new Error(`Error creating file: ${error.message}`);
    }
  }

  async findFileByMaintenanceId(maintenanceId: number): Promise<File | null> {
    try {
      const file = await this.filesRepository.findOne({
        where: { maintenance_id: maintenanceId },
      });
      if (!file) {
        throw new NotFoundException(
          `File with Maintenance ID ${maintenanceId} not found`,
        );
      }
      return file;
    } catch (error) {
      throw new Error(
        `Error finding file for this maintenance session: ${error.message}`,
      );
    }
  }
}
