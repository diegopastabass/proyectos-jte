import {
  BadRequestException,
  Controller,
  Get,
  Module,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  RolMinimo,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import { ImportacionService } from './importacion.service';

const MAX_BYTES = 10 * 1024 * 1024;

@Controller('empresas/:empresaId/importaciones')
export class ImportacionController {
  constructor(private readonly servicio: ImportacionService) {}

  @Get()
  listar(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.listar(empresaId);
  }

  /**
   * multipart/form-data con el campo "archivo". El tipo (cartola BancoEstado / RCV compra / RCV venta)
   * y la cuenta se detectan desde el contenido. El archivo se procesa en memoria y no se guarda.
   */
  @Post()
  @RolMinimo('operador')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
    }),
  )
  importar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    if (!archivo)
      throw new BadRequestException('Falta el archivo (campo "archivo")');
    // multer entrega el nombre en latin1; se corrige para nombres con tildes.
    const originalname = Buffer.from(archivo.originalname, 'latin1').toString(
      'utf8',
    );
    return this.servicio.importar(empresaId, usuario.id, {
      originalname,
      buffer: archivo.buffer,
    });
  }
}

@Module({
  controllers: [ImportacionController],
  providers: [ImportacionService],
})
export class ImportacionModule {}
