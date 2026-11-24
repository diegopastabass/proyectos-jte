import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsBoolean } from 'class-validator';
import { DataSource } from 'typeorm';
import {
  RolMinimo,
  type UsuarioActual,
  UsuarioAutenticado,
} from '../auth/auth.decorators';
import { auditar } from '../common/auditoria';
import { ConexionExterna, Empresa, type SistemaExterno } from '../entities';
import {
  ImportacionService,
  type LecturaApi,
} from '../importacion/importacion.service';
import { MotorModule, MotorService } from '../motor/motor.module';
import { normalizarRut } from '../common/rut';
import {
  cartolasDesdeBancoChile,
  cartolasDesdeBancoEstado,
  conexionDeEmpresa,
  type DocumentoRcvEmisso,
  type MovimientoBancoChile,
  type MovimientoBancoEstado,
  periodosALeer,
  rcvDesdeEmisso,
  type SincronizacionRcv,
} from './conectores';
import {
  EmissoClient,
  ErrorEmisso,
  origenesPermitidos,
  type SesionConexion,
} from './emisso.client';

/** Lo que se pide a Emisso al conectar cada fuente. */
const SISTEMAS: Record<
  SistemaExterno,
  { nombre: string; alcances: string[]; esquema?: string }
> = {
  // Clave tributaria de la empresa: lee el RCV y no puede emitir.
  sii: { nombre: 'SII', alcances: ['rcv'], esquema: 'portal_credentials' },
  banco_estado: { nombre: 'BancoEstado', alcances: ['saldos', 'movimientos'] },
  bch_empresas: {
    nombre: 'Banco de Chile',
    alcances: ['saldos', 'movimientos'],
  },
};
const CODIGOS = Object.keys(SISTEMAS) as SistemaExterno[];

class ActualizarConexionDto {
  @IsBoolean() activa: boolean;
}

/** Estado en Emisso de una conexión (de `conexiones.estado.consultar`), recortado para la pantalla. */
interface EstadoEmisso {
  estado: string;
  credencial: string;
  cadencia: string | null;
  cadenciaEstado: string | null;
  datosListos: boolean;
  atenciones: { codigo: string; que: string; hacer: string }[];
  trabajos: {
    id: string;
    estado: string;
    periodo: string;
    actualizadoEn: string;
  }[];
  uso: { llamadas: number; limite: number; seRenueva: string } | null;
}

export interface ResultadoLectura {
  sistema: SistemaExterno;
  importaciones: number;
  nuevas: number;
  advertencias: string[];
  error: string | null;
}

@Injectable()
export class IngestaService {
  private readonly logger = new Logger(IngestaService.name);
  /** Orígenes https del front que pueden incrustar la página de Emisso (iframe). */
  private readonly origenes: string[];
  /** Lecturas en curso por empresa, para que el job y el botón no corran a la vez. */
  private readonly enCurso = new Set<number>();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly emisso: EmissoClient,
    private readonly importacion: ImportacionService,
    private readonly motor: MotorService,
    config: ConfigService,
  ) {
    const variable = config.get<string>('EMISSO_ORIGENES')
      ? 'EMISSO_ORIGENES'
      : 'CORS_ORIGINS';
    const { origenes, descartados } = origenesPermitidos(
      config.get<string>(variable),
    );
    this.origenes = origenes;
    // Desde CORS_ORIGINS es normal que sobren (http de desarrollo): solo se avisa en la propia.
    if (descartados.length && variable === 'EMISSO_ORIGENES')
      this.logger.warn(
        `EMISSO_ORIGENES: se ignoran ${descartados.join(', ')} ` +
          '(Emisso acepta hasta 5 orígenes https, sin ruta ni comodines)',
      );
  }

  /** Las tres fuentes de la empresa, con lo guardado aquí y el estado en vivo de Emisso. */
  async listar(empresaId: number) {
    const filas = await this.ds
      .getRepository(ConexionExterna)
      .findBy({ empresaId });
    let enEmisso = new Map<string, EstadoEmisso>();
    let errorEmisso: string | null = null;
    if (this.emisso.configurado && filas.some((f) => f.connectionId)) {
      try {
        const r = await this.emisso.ejecutar<{
          conexiones: (EstadoEmisso & { id: string })[];
        }>('conexiones.estado.consultar', {});
        enEmisso = new Map(r.conexiones.map((c) => [c.id, c]));
      } catch (e) {
        errorEmisso = textoError(e, 'conexiones:read');
      }
    }
    return {
      configurado: this.emisso.configurado,
      embebible: this.origenes.length > 0,
      errorEmisso,
      conexiones: CODIGOS.map((sistema) => {
        const f = filas.find((x) => x.sistema === sistema);
        const e = f?.connectionId ? enEmisso.get(f.connectionId) : undefined;
        return {
          sistema,
          nombre: SISTEMAS[sistema].nombre,
          estado: f ? f.estado : 'sin_conectar',
          connectionId: f?.connectionId ?? null,
          empresaRut: f?.empresaRut ?? null,
          ultimaLecturaEn: f?.ultimaLecturaEn ?? null,
          ultimoError: f?.ultimoError ?? null,
          emisso: e
            ? {
                estado: e.estado,
                credencial: e.credencial,
                cadencia: e.cadencia,
                cadenciaEstado: e.cadenciaEstado,
                datosListos: e.datosListos,
                atenciones: (e.atenciones ?? []).map((a) => ({
                  codigo: a.codigo,
                  que: a.que,
                  hacer: a.hacer,
                })),
                trabajos: (e.trabajos ?? []).slice(0, 3).map((t) => ({
                  id: t.id,
                  estado: t.estado,
                  periodo: t.periodo,
                  actualizadoEn: t.actualizadoEn,
                })),
                uso: e.uso
                  ? {
                      llamadas: e.uso.llamadas,
                      limite: e.uso.limite,
                      seRenueva: e.uso.seRenueva,
                    }
                  : null,
              }
            : null,
        };
      }),
    };
  }

  /**
   * Enlace de un solo uso donde la persona escribe la clave del SII o del banco, en la página de
   * Emisso (incrustada en Configuración si hay orígenes https). La clave nunca pasa por esta API.
   * Si la fuente ya estaba conectada, el enlace renueva la clave de la misma conexión.
   */
  async crearEnlace(
    empresaId: number,
    sistema: SistemaExterno,
    usuario: UsuarioActual,
  ) {
    const empresa = await this.empresa(empresaId);
    const repo = this.ds.getRepository(ConexionExterna);
    const previa = await repo.findOneBy({ empresaId, sistema });
    const def = SISTEMAS[sistema];
    const reconectar = !!previa?.connectionId;

    const sesion = await this.llamar('conexiones:write', () =>
      this.emisso.crearSesion({
        ...(reconectar
          ? { mode: 'reauth', connection_id: previa.connectionId }
          : {
              mode: 'create',
              connector_code: sistema,
              ...(def.esquema ? { credential_scheme: def.esquema } : {}),
              ...(sistema === 'sii' ? { emitir: false } : {}),
              alcances: def.alcances,
              // Único por sistema dentro de la organización de Emisso: por eso lleva el RUT.
              display_name: `${empresa.rut} ${empresa.razonSocial}`.slice(
                0,
                80,
              ),
            }),
        ...(this.origenes.length ? { allowed_origins: this.origenes } : {}),
      }),
    );
    if (!sesion.url)
      throw new HttpException('Emisso no devolvió la URL del enlace', 502);

    await repo.save({
      ...(previa ?? { empresaId, sistema, proveedor: 'emisso' as const }),
      sesionId: sesion.id,
      estado: previa?.estado ?? 'pendiente',
      actualizadoEn: new Date(),
    });
    await auditar(this.ds.manager, {
      empresaId,
      usuarioId: usuario.id,
      accion: reconectar ? 'conexion.reconectar' : 'conexion.enlace',
      entidad: 'conexion_externa',
      detalle: { sistema, sesion: sesion.id },
    });
    return {
      url: sesion.url,
      origen: new URL(sesion.url).origin,
      embebible: this.origenes.length > 0,
      expiraEn: sesion.expires_at,
      reconectar,
    };
  }

  /**
   * Comprueba en Emisso que la fuente quedó conectada y guarda la conexión. No se confía en lo que
   * diga el navegador: se busca la sesión emitida y se valida que el RUT sea el de la empresa.
   * Si esa sesión no se consumió (la clave se entregó en otro enlace o directo en el panel de
   * Emisso), se adopta la conexión de Emisso de esta fuente cuyo RUT es el de la empresa.
   */
  async confirmar(
    empresaId: number,
    sistema: SistemaExterno,
    usuario: UsuarioActual,
  ) {
    const empresa = await this.empresa(empresaId);
    const repo = this.ds.getRepository(ConexionExterna);
    const previa = await repo.findOneBy({ empresaId, sistema });

    let sesion: SesionConexion | undefined;
    if (previa?.sesionId) {
      const sesiones = await this.llamar('conexiones:read', () =>
        this.emisso.listarSesiones(),
      );
      sesion = sesiones.find((s) => s.id === previa.sesionId);
    }
    const desdeSesion =
      sesion?.status === 'consumed'
        ? (sesion.resulting_connection_id ?? sesion.connection_id)
        : null;

    const conexiones = await this.llamar('conexiones:read', () =>
      this.emisso.listarConexiones(),
    );
    let conexion = desdeSesion
      ? conexiones.find((c) => c.id === desdeSesion)
      : undefined;
    if (!desdeSesion) {
      const ocupadas = new Set(
        (await repo.find())
          .filter((f) => f.connectionId && f.id !== previa?.id)
          .map((f) => f.connectionId as string),
      );
      conexion =
        conexionDeEmpresa(conexiones, sistema, empresa.rut, ocupadas) ??
        undefined;
      if (!conexion)
        throw new BadRequestException(
          !previa?.sesionId
            ? 'Primero genere el enlace de conexión'
            : sesion?.status === 'expired' || sesion?.status === 'revoked'
              ? 'El enlace venció: genere uno nuevo'
              : 'Emisso todavía no recibe la clave. Complete el formulario y vuelva a intentar.',
        );
    }
    const connectionId = (desdeSesion ?? conexion?.id) as string;

    const fila =
      previa ??
      repo.create({
        empresaId,
        sistema,
        proveedor: 'emisso',
        estado: 'pendiente',
        actualizadoEn: new Date(),
      });
    const rut = conexion?.empresa_rut
      ? (normalizarRut(conexion.empresa_rut) ?? conexion.empresa_rut)
      : null;
    const rutEmpresa = normalizarRut(empresa.rut) ?? empresa.rut;
    if (rut && rut !== rutEmpresa) {
      fila.ultimoError = `La clave entregada es de la empresa ${rut}, no de ${rutEmpresa}`;
      fila.actualizadoEn = new Date();
      await repo.save(fila);
      throw new BadRequestException(fila.ultimoError);
    }
    const otra = await repo.findOneBy({ connectionId });
    if (otra && otra.id !== fila.id)
      throw new ConflictException(
        'Esa conexión de Emisso ya está asociada a otra empresa',
      );

    fila.connectionId = connectionId;
    fila.empresaRut = rut;
    fila.estado = 'activa';
    fila.ultimoError = null;
    fila.actualizadoEn = new Date();
    await repo.save(fila);
    await auditar(this.ds.manager, {
      empresaId,
      usuarioId: usuario.id,
      accion: 'conexion.confirmar',
      entidad: 'conexion_externa',
      entidadId: fila.id,
      detalle: { sistema, connectionId, adoptada: !desdeSesion },
    });
    return fila;
  }

  async actualizar(
    empresaId: number,
    sistema: SistemaExterno,
    dto: ActualizarConexionDto,
    usuario: UsuarioActual,
  ) {
    const repo = this.ds.getRepository(ConexionExterna);
    const fila = await repo.findOneBy({ empresaId, sistema });
    if (!fila?.connectionId)
      throw new NotFoundException('La fuente no está conectada');
    fila.estado = dto.activa ? 'activa' : 'pausada';
    fila.actualizadoEn = new Date();
    await repo.save(fila);
    await auditar(this.ds.manager, {
      empresaId,
      usuarioId: usuario.id,
      accion: dto.activa ? 'conexion.reanudar' : 'conexion.pausar',
      entidad: 'conexion_externa',
      entidadId: fila.id,
      detalle: { sistema },
    });
    return fila;
  }

  /**
   * Pide a Emisso que vuelva a traer el mes en curso y el anterior ahora, sin esperar su ciclo
   * de 4 horas. Solo encola: los datos se leen después con `leer`.
   */
  async sincronizar(empresaId: number, sistema: SistemaExterno) {
    const fila = await this.ds
      .getRepository(ConexionExterna)
      .findOneBy({ empresaId, sistema });
    if (!fila?.connectionId)
      throw new NotFoundException('La fuente no está conectada');
    const jobIds = await this.llamar(`${sistema}:read`, () =>
      this.emisso.pedirSync(fila.connectionId!, periodosALeer(new Date())),
    );
    return { jobIds };
  }

  /**
   * Lee de Emisso lo ya sincronizado (mes en curso y anterior) de las fuentes activas e importa
   * lo nuevo. Si entró algo, corre el motor como el botón «Buscar coincidencias».
   */
  async leer(
    empresaId: number,
    usuarioId: number | null,
    sistema?: SistemaExterno,
  ) {
    if (!this.emisso.configurado)
      throw new HttpException(
        'Falta EMISSO_API_KEY en la configuración de la API',
        503,
      );
    if (this.enCurso.has(empresaId))
      throw new ConflictException(
        'Ya hay una lectura en curso para esta empresa',
      );
    this.enCurso.add(empresaId);
    try {
      const filas = await this.ds.getRepository(ConexionExterna).findBy({
        empresaId,
        estado: 'activa',
        ...(sistema ? { sistema } : {}),
      });
      const resultados: ResultadoLectura[] = [];
      for (const f of filas.filter((x) => x.connectionId))
        resultados.push(await this.leerConexion(f));

      const nuevas = resultados.reduce((s, r) => s + r.nuevas, 0);
      let motor: unknown = null;
      if (nuevas > 0) {
        try {
          motor = await this.motor.ejecutar(empresaId, usuarioId, {});
        } catch (e) {
          this.logger.error(
            `Motor tras la ingesta de la empresa ${empresaId}: ${(e as Error).message}`,
          );
        }
      }
      return { resultados, nuevas, motor };
    } finally {
      this.enCurso.delete(empresaId);
    }
  }

  /** Cada 4 horas, media hora después del ciclo de Emisso (y después del cierre nocturno del banco). */
  @Cron('0 30 */4 * * *', { timeZone: 'America/Santiago' })
  async leerTodas() {
    if (!this.emisso.configurado) return;
    const empresas: { empresa_id: number }[] = await this.ds.query(
      `SELECT DISTINCT empresa_id FROM conexion_externa
        WHERE estado = 'activa' AND connection_id IS NOT NULL ORDER BY empresa_id`,
    );
    for (const { empresa_id } of empresas) {
      try {
        const r = await this.leer(empresa_id, null);
        this.logger.log(
          `Ingesta empresa ${empresa_id}: ${r.nuevas} filas nuevas`,
        );
      } catch (e) {
        this.logger.error(
          `Ingesta empresa ${empresa_id}: ${(e as Error).message}`,
        );
      }
    }
  }

  private async leerConexion(f: ConexionExterna): Promise<ResultadoLectura> {
    const resultado: ResultadoLectura = {
      sistema: f.sistema,
      importaciones: 0,
      nuevas: 0,
      advertencias: [],
      error: null,
    };
    const conn = f.connectionId!;
    try {
      for (const periodo of periodosALeer(new Date())) {
        for (const [nombre, lectura] of await this.lecturas(
          f.sistema,
          conn,
          periodo,
          resultado.advertencias,
        )) {
          const r = await this.importacion.importarDesdeApi(
            f.empresaId,
            nombre,
            lectura,
          );
          if (!r || r.sinCambios) continue;
          resultado.importaciones++;
          resultado.nuevas += r.importacion.filasNuevas;
          resultado.advertencias.push(...r.importacion.advertencias);
        }
      }
      f.ultimaLecturaEn = new Date();
      f.ultimoError = null;
    } catch (e) {
      resultado.error = textoError(e, `${f.sistema}:read`);
      f.ultimoError = resultado.error;
      this.logger.warn(
        `Lectura ${f.sistema} de la empresa ${f.empresaId}: ${resultado.error}`,
      );
    }
    f.actualizadoEn = new Date();
    await this.ds.getRepository(ConexionExterna).save(f);
    return resultado;
  }

  /** Lo que hay que importar de una fuente en un mes, cada lectura con su nombre en el historial. */
  private async lecturas(
    sistema: SistemaExterno,
    conn: string,
    periodo: string,
    advertencias: string[],
  ): Promise<[string, LecturaApi][]> {
    if (sistema === 'sii') {
      const salida: [string, LecturaApi][] = [];
      for (const perspectiva of ['ventas', 'compras'] as const) {
        const { filas, ultima } = await this.emisso.paginar<DocumentoRcvEmisso>(
          'sii.rcv.consultar',
          { periodo, perspectiva },
          'documentos',
          conn,
        );
        const rcv = rcvDesdeEmisso(
          filas,
          (ultima.sincronizacion as SincronizacionRcv | null) ?? null,
          perspectiva,
          periodo,
        );
        if (!rcv) {
          advertencias.push(
            `Emisso todavía no carga el RCV de ${perspectiva} de ${periodo}`,
          );
          continue;
        }
        salida.push([
          `emisso:sii:${perspectiva}:${periodo}`,
          { clase: 'rcv', rcv },
        ]);
      }
      return salida;
    }

    const cartolas =
      sistema === 'banco_estado'
        ? cartolasDesdeBancoEstado(
            (
              await this.emisso.paginar<MovimientoBancoEstado>(
                'banco_estado.movimientos.consultar',
                { periodo, estado: 'definitivo' },
                'movimientos',
                conn,
              )
            ).filas,
          )
        : cartolasDesdeBancoChile(
            (
              await this.emisso.paginar<MovimientoBancoChile>(
                'bch_empresas.movimientos.consultar',
                { periodo },
                'movimientos',
                conn,
              )
            ).filas,
          );
    return cartolas.map((cartola) => [
      `emisso:${sistema}:${cartola.numeroCuenta}:${periodo}`,
      { clase: 'cartola', cartola },
    ]);
  }

  private async empresa(id: number) {
    const empresa = await this.ds.getRepository(Empresa).findOneBy({ id });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  /**
   * Traduce los errores de Emisso a respuestas para el front. Un 401/403 de Emisso es un problema
   * de nuestra API key, no de la sesión del usuario: va como 502 para no cerrarle la sesión.
   * `permiso` es el scope que exige la llamada, para decir cuál falta si la clave no lo tiene.
   */
  private async llamar<T>(permiso: string, fn: () => Promise<T>): Promise<T> {
    if (!this.emisso.configurado)
      throw new HttpException(
        'Falta EMISSO_API_KEY en la configuración de la API',
        503,
      );
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ErrorEmisso)) throw e;
      const status =
        e.status === 401 || e.status === 403
          ? 502
          : e.status === 428
            ? 409
            : e.status >= 400 && e.status < 500
              ? e.status
              : 502;
      throw new HttpException(
        {
          message: textoError(e, permiso),
          code: e.code,
          reintentarEn: e.reintentarEn,
        },
        status,
      );
    }
  }
}

@Controller('empresas/:empresaId/conexiones')
export class IngestaController {
  constructor(private readonly servicio: IngestaService) {}

  @Get()
  listar(@Param('empresaId', ParseIntPipe) empresaId: number) {
    return this.servicio.listar(empresaId);
  }

  @Post(':sistema/enlace')
  @RolMinimo('admin')
  crearEnlace(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('sistema') sistema: string,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.crearEnlace(
      empresaId,
      sistemaValido(sistema),
      usuario,
    );
  }

  @Post(':sistema/confirmar')
  @HttpCode(200)
  @RolMinimo('admin')
  confirmar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('sistema') sistema: string,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.confirmar(empresaId, sistemaValido(sistema), usuario);
  }

  @Patch(':sistema')
  @RolMinimo('admin')
  actualizar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('sistema') sistema: string,
    @Body() dto: ActualizarConexionDto,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.actualizar(
      empresaId,
      sistemaValido(sistema),
      dto,
      usuario,
    );
  }

  @Post(':sistema/sincronizar')
  @HttpCode(200)
  @RolMinimo('operador')
  sincronizar(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('sistema') sistema: string,
  ) {
    return this.servicio.sincronizar(empresaId, sistemaValido(sistema));
  }

  /** Lee lo ya sincronizado en Emisso. `todas` lee las tres fuentes. */
  @Post(':sistema/leer')
  @HttpCode(200)
  @RolMinimo('operador')
  leer(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Param('sistema') sistema: string,
    @UsuarioAutenticado() usuario: UsuarioActual,
  ) {
    return this.servicio.leer(
      empresaId,
      usuario.id,
      sistema === 'todas' ? undefined : sistemaValido(sistema),
    );
  }
}

/** Mensaje para la persona: dice qué hacer, no solo el código de Emisso. */
function textoError(e: unknown, permiso: string): string {
  if (!(e instanceof ErrorEmisso)) return (e as Error).message;
  if (e.code === 'scope_not_granted')
    return (
      `La API key de Emisso no tiene el permiso «${permiso}». Agréguelo en connect.emisso.ai/api-keys ` +
      '→ la clave → «Editar clave»; el valor de la clave no cambia.'
    );
  if (e.status === 401)
    return 'Emisso rechazó la API key (EMISSO_API_KEY): está mal copiada, venció o fue revocada.';
  if (e.pideReconectar)
    return 'La clave del banco o del SII ya no sirve: use «Reconectar» para entregarla de nuevo';
  return `Emisso: ${e.message}${e.sugerencia ? `. ${e.sugerencia}` : ''}`;
}

function sistemaValido(sistema: string): SistemaExterno {
  if (!(CODIGOS as string[]).includes(sistema))
    throw new BadRequestException(`Fuente desconocida: ${sistema}`);
  return sistema as SistemaExterno;
}

@Module({
  imports: [MotorModule],
  controllers: [IngestaController],
  providers: [IngestaService, EmissoClient, ImportacionService],
})
export class IngestaModule {}
