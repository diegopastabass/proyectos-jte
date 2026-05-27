import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from './entities/site-setting.entity';
import { User } from '../users/entities/user.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SiteSetting)
    private readonly settingRepo: Repository<SiteSetting>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Return all site settings.
   */
  async findAll(): Promise<SiteSetting[]> {
    return this.settingRepo.find({ order: { key: 'ASC' } });
  }

  /**
   * Find a single setting by its key.
   */
  async findByKey(key: string): Promise<SiteSetting> {
    const setting = await this.settingRepo.findOne({
      where: { key },
      relations: { updatedBy: true },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    return setting;
  }

  /**
   * Update a setting's value and description.
   * Sets the updatedBy relation to the acting admin user.
   */
  async update(
    key: string,
    dto: UpdateSettingDto,
    userId: string,
  ): Promise<SiteSetting> {
    const setting = await this.findByKey(key);

    setting.value = dto.value;

    if (dto.description !== undefined) {
      setting.description = dto.description;
    }

    setting.updatedBy = { id: userId } as User;

    return this.settingRepo.save(setting);
  }
}
