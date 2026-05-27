import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Publication } from './entities/publication.entity';
import { Tag } from '../tags/entities/tag.entity';
import { CreatePublicationDto } from './dto/create-publication.dto';
import { UpdatePublicationDto } from './dto/update-publication.dto';
import { QueryPublicationDto } from './dto/query-publication.dto';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class PublicationsService {
  constructor(
    @InjectRepository(Publication)
    private readonly publicationsRepository: Repository<Publication>,
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  async findAll(query: QueryPublicationDto) {
    const { page = 1, limit = 12, categoryId, search, minPrice, maxPrice, tagId, isFeatured, isActive } = query;

    const qb = this.publicationsRepository
      .createQueryBuilder('pub')
      .leftJoinAndSelect('pub.category', 'category')
      .leftJoinAndSelect('pub.tags', 'tags');

    // Por defecto solo mostrar activas (endpoints públicos)
    if (isActive !== undefined) {
      qb.andWhere('pub.isActive = :isActive', { isActive });
    } else {
      qb.andWhere('pub.isActive = :isActive', { isActive: true });
    }

    if (categoryId) {
      qb.andWhere('pub.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(pub.title) LIKE LOWER(:search) OR LOWER(pub.description) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (minPrice !== undefined) {
      qb.andWhere('pub.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      qb.andWhere('pub.price <= :maxPrice', { maxPrice });
    }

    if (tagId) {
      qb.andWhere('tags.id = :tagId', { tagId });
    }

    if (isFeatured !== undefined) {
      qb.andWhere('pub.isFeatured = :isFeatured', { isFeatured });
    }

    qb.orderBy('pub.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFeatured(): Promise<Publication[]> {
    return this.publicationsRepository.find({
      where: { isActive: true, isFeatured: true },
      relations: { category: true, tags: true },
      order: { createdAt: 'DESC' },
      take: 12,
    });
  }

  async findBySlug(slug: string): Promise<Publication> {
    const publication = await this.publicationsRepository.findOne({
      where: { slug },
      relations: { category: true, tags: true, user: true },
    });

    if (!publication) {
      throw new NotFoundException(`Publicación con slug "${slug}" no encontrada`);
    }

    return publication;
  }

  async findOne(id: string): Promise<Publication> {
    const publication = await this.publicationsRepository.findOne({
      where: { id },
      relations: { category: true, tags: true },
    });

    if (!publication) {
      throw new NotFoundException(`Publicación con ID "${id}" no encontrada`);
    }

    return publication;
  }

  async create(dto: CreatePublicationDto, userId: string): Promise<Publication> {
    const slug = generateSlug(dto.title);

    const publication = this.publicationsRepository.create({
      title: dto.title,
      slug,
      description: dto.description,
      shortDescription: dto.shortDescription,
      price: dto.price,
      comparePrice: dto.comparePrice,
      isFeatured: dto.isFeatured ?? false,
      metadata: dto.metadata ?? {},
      user: { id: userId } as any,
      category: dto.categoryId ? ({ id: dto.categoryId } as any) : null,
    });

    if (dto.tagIds && dto.tagIds.length > 0) {
      const tags = await this.tagsRepository.findBy({ id: In(dto.tagIds) });
      publication.tags = tags;
    }

    return this.publicationsRepository.save(publication);
  }

  async update(id: string, dto: UpdatePublicationDto): Promise<Publication> {
    const publication = await this.findOne(id);

    if (dto.tagIds !== undefined) {
      if (dto.tagIds.length > 0) {
        publication.tags = await this.tagsRepository.findBy({ id: In(dto.tagIds) });
      } else {
        publication.tags = [];
      }
    }

    if (dto.categoryId !== undefined) {
      publication.category = dto.categoryId
        ? ({ id: dto.categoryId } as any)
        : null;
    }

    const { tagIds, categoryId, ...rest } = dto;
    Object.assign(publication, rest);

    return this.publicationsRepository.save(publication);
  }

  async remove(id: string): Promise<Publication> {
    const publication = await this.findOne(id);
    publication.isActive = false;
    return this.publicationsRepository.save(publication);
  }

  async addImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<Publication> {
    const publication = await this.findOne(id);

    const currentImages = (publication.images as any[]) || [];
    const newImages = files.map((file, index) => ({
      url: `/uploads/products/${file.filename}`,
      alt: '',
      order: currentImages.length + index,
    }));

    publication.images = [...currentImages, ...newImages];
    return this.publicationsRepository.save(publication);
  }

  async removeImage(id: string, imageIndex: number): Promise<Publication> {
    const publication = await this.findOne(id);
    const images = (publication.images as any[]) || [];

    if (imageIndex < 0 || imageIndex >= images.length) {
      throw new BadRequestException('Índice de imagen inválido');
    }

    const removedImage = images[imageIndex];

    // Eliminar archivo del filesystem
    try {
      const filePath = path.join(process.cwd(), removedImage.url);
      await fs.unlink(filePath);
    } catch {
      // El archivo puede no existir, continuar
    }

    images.splice(imageIndex, 1);

    // Reindexar el orden
    images.forEach((img, idx) => {
      img.order = idx;
    });

    publication.images = images;
    return this.publicationsRepository.save(publication);
  }

  async reorderImages(id: string, newOrder: number[]): Promise<Publication> {
    const publication = await this.findOne(id);
    const images = (publication.images as any[]) || [];

    if (newOrder.length !== images.length) {
      throw new BadRequestException(
        'El array de orden debe tener la misma cantidad de elementos que las imágenes',
      );
    }

    const reorderedImages = newOrder.map((oldIndex, newIndex) => {
      if (oldIndex < 0 || oldIndex >= images.length) {
        throw new BadRequestException(`Índice ${oldIndex} fuera de rango`);
      }
      return { ...images[oldIndex], order: newIndex };
    });

    publication.images = reorderedImages;
    return this.publicationsRepository.save(publication);
  }
}
