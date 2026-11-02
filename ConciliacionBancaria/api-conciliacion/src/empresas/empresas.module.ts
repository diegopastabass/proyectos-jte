import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  InjectDataSource,
  InjectRepository,
  TypeOrmModule,
} from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import {
  RolMinimo,
  SoloAdmin,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import { auditar, consultar } from '../common/auditoria';
import { normalizarRut } from '../common/rut';
import {
  Categoria,
  Contraparte,
  CuentaBancaria,
  Empresa,
  type RolEmpresa,
  Usuario,
  UsuarioEmpresa,
} from '../entities';

/** Categorías con que parte cada empresa (gastos y movimientos sin documento tributario). */
export const CATEGORIAS_INICIALES: Pick<Categoria, 'nombre' | 'tipo'>[] = [
  { nombre: 'Traspaso entre cuentas propias', tipo: 'traspaso' },
  { nombre: 'Retiro del dueño', tipo: 'retiro' },
  { nombre: 'Remuneraciones y honorarios', tipo: 'gasto' },
  { nombre: 'Comisiones y gastos bancarios', tipo: 'gasto' },
  { nombre: 'Impuestos (F29, F22)', tipo: 'impuesto' },
  { nombre: 'Combustible y peajes', tipo: 'gasto' },
  { nombre: 'Gastos sin documento', tipo: 'gasto' },
  { nombre: 'Ingresos sin documento', tipo: 'ingreso' },
];

// ---------------------------------------------------------------- DTOs

class CrearUsuarioDto {
  @IsEmail() email: string;
  @IsString() @MinLength(10) password: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsBoolean() esAdmin?: boolean;
}

class CrearEmpresaDto {
  @IsString() rut: string;
  @IsString() @IsNotEmpty() razonSocial: string;
}

class ActualizarUsuarioDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsBoolean() esAdmin?: boolean;
  /** Restablecer la contraseña (el usuario puede cambiarla después en PATCH /auth/password). */
  @IsOptional() @IsString() @MinLength(10) password?: string;
}

class AsignarUsuarioDto {
  @IsInt() usuarioId: number;
  @IsIn(['admin', 'operador', 'lector']) rol: RolEmpresa;
}

class CrearCuentaDto {
  @IsIn(['bancoestado', 'banco_chile']) banco: 'bancoestado' | 'banco_chile';
  @IsString() @IsNotEmpty() numero: string;
  @IsOptional() @IsString() alias?: string;
}

class ActualizarCuentaDto {
  @IsOptional() @IsString() alias?: string;
  @IsOptional() @IsBoolean() activa?: boolean;
}

class CrearCategoriaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsIn(['ingreso', 'gasto', 'traspaso', 'retiro', 'impuesto', 'otro'])
  tipo: Categoria['tipo'];
}

class CrearContraparteDto {
  @IsOptional() @IsString() rut?: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsIn([
    'cliente',
    'proveedor',
    'cliente_proveedor',
    'propia',
    'persona',
    'otro',
  ])
  tipo: Contraparte['tipo'];
  @IsOptional() @IsInt() categoriaId?: number;
}

class ActualizarContraparteDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional()
  @IsIn([
    'cliente',
    'proveedor',
    'cliente_proveedor',
    'propia',
    'persona',
    'otro',
  ])
  tipo?: Contraparte['tipo'];
  /** null = volver a conciliar documento a documento. */
  @IsOptional() @IsInt() categoriaId?: number | null;
}

// ---------------------------------------------------------------- Servicio

@Injectable()
export class EmpresasService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
    @InjectRepository(UsuarioEmpresa)
    private readonly accesos: Repository<UsuarioEmpresa>,
    @InjectRepository(CuentaBancaria)
    private readonly cuentas: Repository<CuentaBancaria>,
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Contraparte)
    private readonly contrapartes: Repository<Contraparte>,
  ) {}

  async crearUsuario(dto: CrearUsuarioDto, actor: UsuarioActual) {
    const existe = await this.usuarios
      .createQueryBuilder('u')
      .where('lower(u.email) = lower(:email)', { email: dto.email })
      .getExists();
    if (existe) throw new ConflictException('El email ya está registrado');
    return this.ds.transaction(async (em) => {
      const usuario = await em.save(
        em.create(Usuario, {
          email: dto.email.trim(),
          hashPassword: await bcrypt.hash(dto.password, 12),
          nombre: dto.nombre.trim(),
          esAdmin: dto.esAdmin ?? false,
          activo: true,
        }),
      );
      await auditar(em, {
        empresaId: null,
        usuarioId: actor.id,
        accion: 'usuario.crear',
        entidad: 'usuario',
        entidadId: usuario.id,
        detalle: { email: usuario.email, esAdmin: usuario.esAdmin },
      });
      return { ...usuario, hashPassword: undefined };
    });
  }

  async actualizarUsuario(
    id: number,
    dto: ActualizarUsuarioDto,
    actor: UsuarioActual,
  ) {
    if (id === actor.id && (dto.activo === false || dto.esAdmin === false)) {
      throw new BadRequestException(
        'No puede desactivarse ni quitarse el admin a sí mismo',
      );
    }
    return this.ds.transaction(async (em) => {
      const usuario = await em.findOneBy(Usuario, { id });
      if (!usuario) throw new NotFoundException('Usuario no encontrado');
      if (dto.nombre !== undefined) usuario.nombre = dto.nombre.trim();
      if (dto.activo !== undefined) usuario.activo = dto.activo;
      if (dto.esAdmin !== undefined) usuario.esAdmin = dto.esAdmin;
      if (dto.password !== undefined)
        usuario.hashPassword = await bcrypt.hash(dto.password, 12);
      await em.save(usuario);
      await auditar(em, {
        empresaId: null,
        usuarioId: actor.id,
        accion: 'usuario.actualizar',
        entidad: 'usuario',
        entidadId: id,
        // Nunca se guarda la contraseña en la auditoría.
        detalle: {
          ...dto,
          password: dto.password ? '(restablecida)' : undefined,
        },
      });
      return { ...usuario, hashPassword: undefined };
    });
  }

  /** Usuarios con acceso a la empresa y su rol. */
  usuariosDeEmpresa(empresaId: number) {
    return consultar<{
      id: number;
      email: string;
      nombre: string;
      activo: boolean;
      rol: RolEmpresa;
    }>(
      this.ds,
      `SELECT u.id, u.email, u.nombre, u.activo, ue.rol
         FROM usuario_empresa ue JOIN usuario u ON u.id = ue.usuario_id
        WHERE ue.empresa_id = $1 ORDER BY u.nombre`,
      [empresaId],
    );
  }

  async quitarUsuario(
    empresaId: number,
    usuarioId: number,
    actor: UsuarioActual,
  ) {
    return this.ds.transaction(async (em) => {
      const r = await em.delete(UsuarioEmpresa, { empresaId, usuarioId });
      if (!r.affected)
        throw new NotFoundException(
          'El usuario no tiene acceso a esta empresa',
        );
      await auditar(em, {
        empresaId,
        usuarioId: actor.id,
        accion: 'empresa.quitar_usuario',
        entidad: 'usuario',
        entidadId: usuarioId,
      });
    });
  }

  /** Números para la pantalla de inicio. */
  async resumen(empresaId: number) {
    const [movimientos, documentos, [sugerencias], cuentas, rcv] =
      await Promise.all([
        consultar<{ estado: string; cantidad: number; porConciliar: number }>(
          this.ds,
          `SELECT estado, count(*)::int AS cantidad, coalesce(sum(abs(monto) - monto_conciliado), 0)::float8 AS "porConciliar"
           FROM movimiento WHERE empresa_id = $1 GROUP BY estado`,
          [empresaId],
        ),
        consultar<{ direccion: string; cantidad: number; saldo: number }>(
          this.ds,
          `SELECT direccion, count(*)::int AS cantidad, coalesce(sum(saldo_pendiente), 0)::float8 AS saldo
           FROM documento WHERE empresa_id = $1 AND estado IN ('pendiente', 'parcial') GROUP BY direccion`,
          [empresaId],
        ),
        consultar<{ pendientes: number }>(
          this.ds,
          `SELECT count(*)::int AS pendientes FROM sugerencia WHERE empresa_id = $1 AND estado = 'pendiente'`,
          [empresaId],
        ),
        consultar<{
          id: number;
          banco: string;
          numero: string;
          alias: string | null;
          saldo: number | null;
          hasta: string | null;
          nCartola: number | null;
        }>(
          this.ds,
          `SELECT c.id, c.banco, c.numero, c.alias, i.saldo_final::float8 AS saldo,
                to_char(i.periodo_hasta, 'YYYY-MM-DD') AS hasta, i.n_cartola AS "nCartola"
           FROM cuenta_bancaria c
           LEFT JOIN LATERAL (
                SELECT saldo_final, periodo_hasta, n_cartola FROM importacion
                 WHERE cuenta_id = c.id ORDER BY periodo_hasta DESC, n_cartola DESC NULLS LAST LIMIT 1) i ON true
          WHERE c.empresa_id = $1 AND c.activa ORDER BY c.banco, c.numero`,
          [empresaId],
        ),
        consultar<{ tipo: string; hasta: string | null }>(
          this.ds,
          `SELECT tipo, to_char(max(periodo_hasta), 'YYYY-MM-DD') AS hasta
           FROM importacion WHERE empresa_id = $1 AND tipo <> 'cartola' GROUP BY tipo`,
          [empresaId],
        ),
      ]);
    return {
      movimientos,
      documentos,
      sugerenciasPendientes: sugerencias?.pendientes ?? 0,
      cuentas,
      rcv,
    };
  }

  listarUsuarios() {
    return this.usuarios.find({ order: { nombre: 'ASC' } });
  }

  /** Crea la empresa con sus categorías iniciales y la contraparte "propia" (para traspasos). */
  async crearEmpresa(dto: CrearEmpresaDto, actor: UsuarioActual) {
    const rut = normalizarRut(dto.rut);
    if (!rut) throw new BadRequestException('RUT inválido');
    if (await this.empresas.existsBy({ rut }))
      throw new ConflictException('La empresa ya existe');

    return this.ds.transaction(async (em) => {
      const empresa = await em.save(
        em.create(Empresa, { rut, razonSocial: dto.razonSocial.trim() }),
      );
      const categorias = await em.save(
        CATEGORIAS_INICIALES.map((c) =>
          em.create(Categoria, { ...c, empresaId: empresa.id, activa: true }),
        ),
      );
      // La propia empresa: sus transferencias son traspasos entre cuentas propias.
      await em.insert(Contraparte, {
        empresaId: empresa.id,
        rut,
        nombre: empresa.razonSocial,
        tipo: 'propia',
        categoriaId: categorias.find((c) => c.tipo === 'traspaso')!.id,
      });
      await em.insert(UsuarioEmpresa, {
        empresaId: empresa.id,
        usuarioId: actor.id,
        rol: 'admin',
      });
      await auditar(em, {
        empresaId: empresa.id,
        usuarioId: actor.id,
        accion: 'empresa.crear',
        entidad: 'empresa',
        entidadId: empresa.id,
        detalle: { rut },
      });
      return empresa;
    });
  }

  async asignarUsuario(
    empresaId: number,
    dto: AsignarUsuarioDto,
    actor: UsuarioActual,
  ) {
    if (!(await this.usuarios.existsBy({ id: dto.usuarioId })))
      throw new NotFoundException('Usuario no existe');
    return this.ds.transaction(async (em) => {
      await em.upsert(
        UsuarioEmpresa,
        { empresaId, usuarioId: dto.usuarioId, rol: dto.rol },
        ['usuarioId', 'empresaId'],
      );
      await auditar(em, {
        empresaId,
        usuarioId: actor.id,
        accion: 'empresa.asignar_usuario',
        entidad: 'usuario',
        entidadId: dto.usuarioId,
        detalle: { rol: dto.rol },
      });
      return { empresaId, usuarioId: dto.usuarioId, rol: dto.rol };
    });
  }

  /** Empresas visibles para el usuario (todas si es admin global), con su rol. */
  async misEmpresas(usuario: UsuarioActual) {
    if (usuario.esAdmin) {
      const todas = await this.empresas.find({ order: { razonSocial: 'ASC' } });
      const rol: RolEmpresa = 'admin';
      return todas.map((e) => ({ ...e, rol }));
    }
    const accesos = await this.accesos.find({
      where: { usuarioId: usuario.id },
      relations: { empresa: true },
      order: { empresa: { razonSocial: 'ASC' } },
    });
    return accesos.map((a) => ({ ...a.empresa, rol: a.rol }));
  }

  async detalle(empresaId: number) {
    const empresa = await this.empresas.findOneBy({ id: empresaId });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  listarCuentas(empresaId: number) {
    return this.cuentas.find({
      where: { empresaId },
      order: { banco: 'ASC', numero: 'ASC' },
    });
  }

  async crearCuenta(empresaId: number, dto: CrearCuentaDto) {
    const numero = dto.numero.replace(/\D/g, '');
    if (!numero) throw new BadRequestException('Número de cuenta inválido');
    if (await this.cuentas.existsBy({ empresaId, banco: dto.banco, numero })) {
      throw new ConflictException('La cuenta ya existe');
    }
    return this.cuentas.save(
      this.cuentas.create({
        empresaId,
        banco: dto.banco,
        numero,
        alias: dto.alias ?? null,
        moneda: 'CLP',
        activa: true,
      }),
    );
  }

  async actualizarCuenta(
    empresaId: number,
    cuentaId: number,
    dto: ActualizarCuentaDto,
  ) {
    const cuenta = await this.cuentas.findOneBy({ id: cuentaId, empresaId });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    Object.assign(cuenta, dto);
    return this.cuentas.save(cuenta);
  }

  listarCategorias(empresaId: number) {
    return this.categorias.find({
      where: { empresaId },
      order: { tipo: 'ASC', nombre: 'ASC' },
    });
  }

  async crearCategoria(empresaId: number, dto: CrearCategoriaDto) {
    if (
      await this.categorias.existsBy({ empresaId, nombre: dto.nombre.trim() })
    ) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }
    return this.categorias.save(
      this.categorias.create({
        empresaId,
        nombre: dto.nombre.trim(),
        tipo: dto.tipo,
        activa: true,
      }),
    );
  }

  listarContrapartes(empresaId: number) {
    return this.contrapartes.find({
      where: { empresaId },
      order: { nombre: 'ASC' },
    });
  }

  /** Para registrar personas sin documentos (ej. retiros o sueldos) y poder reconocerlas en la glosa. */
  async crearContraparte(empresaId: number, dto: CrearContraparteDto) {
    const rut = dto.rut ? normalizarRut(dto.rut) : null;
    if (dto.rut && !rut) throw new BadRequestException('RUT inválido');
    if (rut && (await this.contrapartes.existsBy({ empresaId, rut }))) {
      throw new ConflictException('Ya existe una contraparte con ese RUT');
    }
    if (dto.categoriaId !== undefined)
      await this.validarCategoria(empresaId, dto.categoriaId);
    return this.contrapartes.save(
      this.contrapartes.create({
        empresaId,
        rut,
        nombre: dto.nombre.trim(),
        tipo: dto.tipo,
        categoriaId: dto.categoriaId ?? null,
      }),
    );
  }

  /**
   * Cambiar la categoría de una contraparte (ej. COPEC → "Combustible y peajes") recalcula sus
   * documentos: con categoría quedan 'excluido' (no son deuda por conciliar); sin ella vuelven.
   */
  async actualizarContraparte(
    empresaId: number,
    id: number,
    dto: ActualizarContraparteDto,
    actor: UsuarioActual,
  ) {
    return this.ds.transaction(async (em) => {
      const c = await em.findOneBy(Contraparte, { id, empresaId });
      if (!c) throw new NotFoundException('Contraparte no encontrada');
      if (dto.categoriaId !== undefined && dto.categoriaId !== null) {
        await this.validarCategoria(empresaId, dto.categoriaId);
      }
      if (dto.nombre !== undefined) c.nombre = dto.nombre.trim();
      if (dto.tipo !== undefined) c.tipo = dto.tipo;
      if (dto.categoriaId !== undefined) c.categoriaId = dto.categoriaId;
      await em.save(c);
      await em.query(
        'SELECT recalcular_documentos(array(SELECT id FROM documento WHERE contraparte_id = $1))',
        [id],
      );
      await auditar(em, {
        empresaId,
        usuarioId: actor.id,
        accion: 'contraparte.actualizar',
        entidad: 'contraparte',
        entidadId: id,
        detalle: { ...dto },
      });
      return c;
    });
  }

  private async validarCategoria(empresaId: number, categoriaId: number) {
    if (
      !(await this.categorias.existsBy({
        id: categoriaId,
        empresaId,
        activa: true,
      }))
    ) {
      throw new BadRequestException('Categoría no encontrada o inactiva');
    }
  }
}

// ---------------------------------------------------------------- Controladores

@Controller('usuarios')
@SoloAdmin()
export class UsuariosController {
  constructor(private readonly servicio: EmpresasService) {}

  @Get()
  listar() {
    return this.servicio.listarUsuarios();
  }

  @Post()
  crear(
    @Body() dto: CrearUsuarioDto,
    @UsuarioAutenticado() actor: UsuarioActual,
  ) {
    return this.servicio.crearUsuario(dto, actor);
  }

  @Patch(':usuarioId')
  actualizar(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioAutenticado() actor: UsuarioActual,
  ) {
    return this.servicio.actualizarUsuario(usuarioId, dto, actor);
  }
}

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly servicio: EmpresasService) {}

  @Get()
  misEmpresas(@UsuarioAutenticado() usuario: UsuarioActual) {
    return this.servicio.misEmpresas(usuario);
  }

  @Post()
  @SoloAdmin()
  crear(
    @Body() dto: CrearEmpresaDto,
    @UsuarioAutenticado() actor: UsuarioActual,
  ) {
    return this.servicio.crearEmpresa(dto, actor);
  }

  @Get(':empresaId')
  detalle(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.detalle(empresaId);
  }

  @Get(':empresaId/resumen')
  resumen(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.resumen(empresaId);
  }

  @Get(':empresaId/usuarios')
  @RolMinimo('admin')
  usuarios(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.usuariosDeEmpresa(empresaId);
  }

  @Delete(':empresaId/usuarios/:usuarioId')
  @HttpCode(204)
  @RolMinimo('admin')
  quitarUsuario(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @UsuarioAutenticado() actor: UsuarioActual,
  ) {
    return this.servicio.quitarUsuario(empresaId, usuarioId, actor);
  }

  @Put(':empresaId/usuarios')
  @RolMinimo('admin')
  asignarUsuario(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: AsignarUsuarioDto,
    @UsuarioAutenticado() actor: UsuarioActual,
  ) {
    return this.servicio.asignarUsuario(empresaId, dto, actor);
  }

  @Get(':empresaId/cuentas')
  cuentas(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.listarCuentas(empresaId);
  }

  @Post(':empresaId/cuentas')
  @RolMinimo('admin')
  crearCuenta(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearCuentaDto,
  ) {
    return this.servicio.crearCuenta(empresaId, dto);
  }

  @Patch(':empresaId/cuentas/:cuentaId')
  @RolMinimo('admin')
  actualizarCuenta(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('cuentaId', ParseIntPipe) cuentaId: number,
    @Body() dto: ActualizarCuentaDto,
  ) {
    return this.servicio.actualizarCuenta(empresaId, cuentaId, dto);
  }

  @Get(':empresaId/categorias')
  categorias(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.listarCategorias(empresaId);
  }

  @Post(':empresaId/categorias')
  @RolMinimo('admin')
  crearCategoria(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearCategoriaDto,
  ) {
    return this.servicio.crearCategoria(empresaId, dto);
  }

  @Get(':empresaId/contrapartes')
  contrapartes(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.listarContrapartes(empresaId);
  }

  @Post(':empresaId/contrapartes')
  @RolMinimo('operador')
  crearContraparte(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Body() dto: CrearContraparteDto,
  ) {
    return this.servicio.crearContraparte(empresaId, dto);
  }

  @Patch(':empresaId/contrapartes/:contraparteId')
  @RolMinimo('admin')
  actualizarContraparte(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('contraparteId', ParseIntPipe) contraparteId: number,
    @Body() dto: ActualizarContraparteDto,
    @UsuarioAutenticado() actor: UsuarioActual,
  ) {
    return this.servicio.actualizarContraparte(
      empresaId,
      contraparteId,
      dto,
      actor,
    );
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Empresa,
      UsuarioEmpresa,
      CuentaBancaria,
      Categoria,
      Contraparte,
    ]),
  ],
  controllers: [UsuariosController, EmpresasController],
  providers: [EmpresasService],
})
export class EmpresasModule {}
