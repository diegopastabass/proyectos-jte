import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    // Obtener categorías raíz activas con sus hijos
    const roots = await this.categoriesRepository.find({
      where: { isActive: true, parent: IsNull() },
      relations: { children: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Filtrar hijos inactivos recursivamente
    return this.filterActiveChildren(roots);
  }

  async findAllAdmin(): Promise<Category[]> {
    return this.categoriesRepository.find({
      relations: { children: true, parent: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { slug },
      relations: { children: true, parent: true },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con slug "${slug}" no encontrada`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = generateSlug(dto.name);

    const category = this.categoriesRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      imageUrl: dto.imageUrl,
      sortOrder: dto.sortOrder ?? 0,
    });

    if (dto.parentId) {
      const parent = await this.categoriesRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Categoría padre con ID "${dto.parentId}" no encontrada`);
      }
      category.parent = parent;
    }

    return this.categoriesRepository.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID "${id}" no encontrada`);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        category.parent = null;
      } else {
        const parent = await this.categoriesRepository.findOne({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException(`Categoría padre con ID "${dto.parentId}" no encontrada`);
        }
        category.parent = parent;
      }
    }

    const { parentId, ...rest } = dto;
    Object.assign(category, rest);

    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Categoría con ID "${id}" no encontrada`);
    }

    category.isActive = false;
    return this.categoriesRepository.save(category);
  }

  private filterActiveChildren(categories: Category[]): Category[] {
    return categories.map((cat) => {
      if (cat.children && cat.children.length > 0) {
        cat.children = this.filterActiveChildren(
          cat.children.filter((child) => child.isActive),
        );
      }
      return cat;
    });
  }
}
