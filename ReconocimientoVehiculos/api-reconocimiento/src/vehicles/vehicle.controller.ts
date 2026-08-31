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
import { VehiculoService } from './vehicle.service.js';
import { CreateVehiculoDto } from './models/create-vehicle.dto.js';
import { UpdateVehiculoDto } from './models/update-vehicle.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('vehiculos')
export class VehiculoController {
  constructor(private readonly vehiculoService: VehiculoService) {}

  @Post()
  create(@Body() createVehiculoDto: CreateVehiculoDto) {
    return this.vehiculoService.create(createVehiculoDto);
  }

  @Get()
  findAll() {
    return this.vehiculoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculoService.findOne(id);
  }

  @Get('patente/:patente')
  async findByPatente(@Param('patente') patente: string) {
    const vehiculo = await this.vehiculoService.findByPatente(patente);
    if (!vehiculo) {
      return { status: 'no_registrado', patente };
    }
    return { status: 'registrado', data: vehiculo };
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVehiculoDto: UpdateVehiculoDto,
  ) {
    return this.vehiculoService.update(id, updateVehiculoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehiculoService.remove(id);
  }
}
