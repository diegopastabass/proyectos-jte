import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Publication } from './entities/publication.entity';
import { Tag } from '../tags/entities/tag.entity';
import { PublicationsService } from './publications.service';
import { PublicationsController } from './publications.controller';

/**
 * Module for managing publications, including CRUD operations
 * and image upload handling via Multer.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Publication, Tag]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dest: configService.get<string>('upload.dest', './uploads'),
        limits: {
          fileSize: configService.get<number>(
            'upload.maxFileSize',
            5242880,
          ),
        },
      }),
    }),
  ],
  controllers: [PublicationsController],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
