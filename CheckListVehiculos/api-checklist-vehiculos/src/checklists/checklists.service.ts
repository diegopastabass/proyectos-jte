import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Checklist } from '../entities/checklist.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { ChecklistImage } from '../entities/checklist-image.entity';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { QueryChecklistsDto } from './dto/query-checklists.dto';

const REQUIRED_EXTERIOR = ['foto_frontal', 'foto_trasera', 'foto_lateral_izquierdo', 'foto_lateral_derecho'];
const MIN_INTERIOR = 2;
const MAX_CHECK_ITEMS = 40;
const TZ = 'America/Santiago';

type CleanItem = { id: string; label: string; isGood: boolean; observation: string; hasPhoto: boolean };

@Injectable()
export class ChecklistsService {
  private readonly logger = new Logger(ChecklistsService.name);

  constructor(
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
    private dataSource: DataSource,
  ) {}

  /** Nombre original sin extensión: "frenos.jpg" -> "frenos" */
  private baseName(originalname: string): string {
    return (originalname || '').replace(/\.[^.]+$/, '');
  }

  /** Valida y limpia los ítems; solo se guardan los campos conocidos y hasPhoto se calcula con los archivos reales. */
  private cleanChecks(section: string, raw: Record<string, any>, photoNames: Set<string>): Record<string, CleanItem> {
    const keys = Object.keys(raw);
    if (keys.length === 0 || keys.length > MAX_CHECK_ITEMS) {
      throw new BadRequestException(`${section}: cantidad de ítems inválida`);
    }
    const out: Record<string, CleanItem> = {};
    for (const key of keys) {
      const item = raw[key];
      if (!/^[a-z0-9_]{1,60}$/.test(key) || !item || typeof item !== 'object' || typeof item.isGood !== 'boolean') {
        throw new BadRequestException(`${section}: ítem "${key}" inválido`);
      }
      const observation = typeof item.observation === 'string' ? item.observation.trim().slice(0, 500) : '';
      const label = typeof item.label === 'string' ? item.label.slice(0, 100) : key;
      if (!item.isGood && !observation) {
        throw new BadRequestException(`Debe indicar una observación para "${label}" (marcado como MALO)`);
      }
      out[key] = { id: key, label, isGood: item.isGood, observation, hasPhoto: photoNames.has(key) };
    }
    return out;
  }

  async create(user_id: string, dto: CreateChecklistDto, files: Express.Multer.File[]): Promise<Checklist> {
    files = files ?? [];
    const photoNames = new Set(files.map(f => this.baseName(f.originalname)));

    // Fotos obligatorias, validadas en el servidor
    const missing = REQUIRED_EXTERIOR.filter(n => !photoNames.has(n));
    if (missing.length) {
      throw new BadRequestException(`Faltan fotos exteriores obligatorias: ${missing.map(m => m.replace('foto_', '')).join(', ')}`);
    }
    const interior = [...photoNames].filter(n => n.startsWith('foto_interior_')).length;
    if (interior < MIN_INTERIOR) {
      throw new BadRequestException(`Debe adjuntar al menos ${MIN_INTERIOR} fotos interiores`);
    }

    const visual = this.cleanChecks('visual_checks', dto.visual_checks, photoNames);
    const mechanical = this.cleanChecks('mechanical_checks', dto.mechanical_checks, photoNames);
    const has_issues = [...Object.values(visual), ...Object.values(mechanical)].some(i => !i.isGood);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloqueo de fila: dos checklists simultáneos del mismo vehículo se atienden en orden
      const vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { id: dto.vehicle_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
      if (!vehicle.is_active) {
        throw new BadRequestException('El vehículo está dado de baja');
      }
      if (dto.kilometraje_actual < vehicle.kilometraje) {
        throw new BadRequestException(
          `El kilometraje (${dto.kilometraje_actual}) no puede ser menor al último registrado (${vehicle.kilometraje})`,
        );
      }

      vehicle.kilometraje = dto.kilometraje_actual;
      await queryRunner.manager.save(vehicle);

      const savedChecklist = await queryRunner.manager.save(
        queryRunner.manager.create(Checklist, {
          user_id,
          vehicle_id: dto.vehicle_id,
          kilometraje_actual: dto.kilometraje_actual,
          visual_checks: visual,
          mechanical_checks: mechanical,
          observaciones_generales: dto.observaciones_generales?.trim() || null,
          has_issues,
        }),
      );

      if (files.length > 0) {
        const images = files.map(file => {
          const name = this.baseName(file.originalname);
          let check_type = 'general';
          let check_item = name.slice(0, 100) || 'general';
          if (name in visual) check_type = 'visual';
          else if (name in mechanical) check_type = 'mecanico';
          else if (REQUIRED_EXTERIOR.includes(name)) check_type = 'exterior';
          else if (name.startsWith('foto_interior_')) check_type = 'interior';
          return queryRunner.manager.create(ChecklistImage, {
            checklist_id: savedChecklist.id,
            image_path: file.filename,
            check_type,
            check_item,
            description: (file.originalname || '').slice(0, 255),
          });
        });
        await queryRunner.manager.save(images);
      }

      await queryRunner.commitTransaction();
      return await this.checklistsRepository.findOne({ where: { id: savedChecklist.id }, relations: ['images'] });
    } catch (err) {
      this.logger.error(`Error in create: ${err.message}`, err.stack);
      await queryRunner.rollbackTransaction();
      throw err; // el controlador borra los archivos subidos
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(user: any, q: QueryChecklistsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const qb = this.checklistsRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.images', 'images')
      .leftJoinAndSelect('c.vehicle', 'vehicle')
      .leftJoin('c.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (!user.is_admin) qb.andWhere('c.user_id = :uid', { uid: user.userId });
    if (q.vehicle_id) qb.andWhere('c.vehicle_id = :vid', { vid: q.vehicle_id });
    if (q.patente) qb.andWhere('vehicle.patente ILIKE :pat', { pat: `%${q.patente.replace(/[\s-]/g, '').replace(/[%_]/g, '')}%` });
    if (q.has_issues !== undefined) qb.andWhere('c.has_issues = :hi', { hi: q.has_issues });
    // Los días se interpretan en hora de Chile, no en UTC
    if (q.desde) qb.andWhere(`c.created_at >= (:desde::date)::timestamp AT TIME ZONE '${TZ}'`, { desde: q.desde.slice(0, 10) });
    if (q.hasta) qb.andWhere(`c.created_at < ((:hasta::date + 1)::timestamp AT TIME ZONE '${TZ}')`, { hasta: q.hasta.slice(0, 10) });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: string, user: any): Promise<Checklist> {
    const checklist = await this.checklistsRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.images', 'images')
      .leftJoinAndSelect('c.vehicle', 'vehicle')
      .leftJoin('c.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .where('c.id = :id', { id })
      .getOne();
    if (!checklist || (!user.is_admin && checklist.user_id !== user.userId)) {
      throw new NotFoundException('Checklist not found');
    }
    return checklist;
  }

  async remove(id: string, user: any): Promise<void> {
    const checklist = await this.findOne(id, user);
    const paths = (checklist.images ?? []).map(i => i.image_path);
    await this.checklistsRepository.remove(checklist);
    // Las filas ya no existen: se borran los archivos (un fallo aquí solo deja un archivo suelto)
    await Promise.all(
      paths.map(p => unlink(join(process.cwd(), 'uploads', p.replace(/^.*[\\/]/, ''))).catch(() => undefined)),
    );
  }
}
