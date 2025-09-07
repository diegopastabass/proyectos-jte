// clients.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateClientDto } from '../clients/create-client.dto';
import { Client } from './clients.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientesRepo: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto): Promise<number> {
    try {
      const cliente = this.clientesRepo.create(dto);
      const result = await this.clientesRepo.save(cliente);
      return result.id;
    } catch (error) {
      throw new InternalServerErrorException(`Error creating client: ${error}`);
    }
  }
  async find(id: number): Promise<Client | null> {
    try {
      const client = await this.clientesRepo.findOne({ where: { id } });
      return client || null;
    } catch (error) {
      throw new InternalServerErrorException(`Error fetching client: ${error}`);
    }
  }

  async findAll(): Promise<{ id: number; name: string }[]> {
    try {
      const clients = await this.clientesRepo.find({
        select: ['id', 'name'],
      });
      return clients;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching clients: ${error}`,
      );
    }
  }
}
