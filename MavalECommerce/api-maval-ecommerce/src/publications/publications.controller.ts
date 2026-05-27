import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';

import { PublicationsService } from './publications.service';
import { CreatePublicationDto } from './dto/create-publication.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import { QueryPublicationDto } from './dto/query-publication.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Controller for managing publications.
 * Public endpoints for listing and viewing; protected endpoints for CRUD and image management.
 */
@Controller('publications')
export class PublicationsController {
  constructor(
    private readonly publicationsService: PublicationsService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // Public endpoints
  // ──────────────────────────────────────────────

  /**
   * List publications with filtering and pagination.
   */
  @Get()
  findAll(@Query() query: QueryPublicationDto) {
    return this.publicationsService.findAll(query);
  }

  /**
   * List featured publications.
   */
  @Get('featured')
  findFeatured() {
    return this.publicationsService.findFeatured();
  }

  /**
   * Get a single publication by slug.
   */
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.publicationsService.findBySlug(slug);
  }

  // ──────────────────────────────────────────────
  // Admin endpoints (protected)
  // ──────────────────────────────────────────────

  /**
   * Create a new publication.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @Body() dto: CreatePublicationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.publicationsService.create(dto, userId);
  }

  /**
   * Update an existing publication.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublicationDto,
  ) {
    return this.publicationsService.update(id, dto);
  }

  /**
   * Soft-delete a publication (sets isActive to false).
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicationsService.remove(id);
  }

  /**
   * Upload images for a publication.
   * Accepts up to 10 image files. Only image MIME types are allowed.
   */
  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (_req, file, cb) => {
          const uniqueName = `${uuid()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\//)) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5242880, // 5 MB default; overridden by module config
      },
    }),
  )
  uploadImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.publicationsService.addImages(id, files);
  }

  /**
   * Reorder images for a publication.
   */
  @Patch(':id/images/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('order') order: number[],
  ) {
    return this.publicationsService.reorderImages(id, order);
  }

  /**
   * Remove a single image from a publication by its index.
   */
  @Delete(':id/images/:index')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.publicationsService.removeImage(id, index);
  }
}
