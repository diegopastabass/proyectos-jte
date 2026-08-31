import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { OwnersService } from './owners.service.js';
import { CreatePersonaDto } from './models/create-owner.dto.js';
import { UpdatePersonaDto } from './models/update-owner.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('personas')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  create(@Body() createPersonaDto: CreatePersonaDto) {
    return this.ownersService.create(createPersonaDto);
  }

  @Get()
  findAll() {
    return this.ownersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ownersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePersonaDto: UpdatePersonaDto,
  ) {
    return this.ownersService.update(id, updatePersonaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ownersService.remove(id);
  }
}
