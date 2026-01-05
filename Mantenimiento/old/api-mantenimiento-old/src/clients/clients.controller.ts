// clients.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './create-client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateClientDto) {
    try {
      const insertedId = await this.service.create(dto);
      return { success: true, insertedId };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching clients by Id: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('find/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    try {
      const client = await this.service.find(id);
      if (!client) {
        return { success: false, message: 'Client not found' };
      }
      return { success: true, client };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching clients by Id: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')
  async findAllClients() {
    try {
      const clients = await this.service.findAll();
      return { success: true, clients };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching clients: ${error.message}`,
      );
    }
  }
}
