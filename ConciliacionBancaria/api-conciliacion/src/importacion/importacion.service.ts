import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { auditar, recalcular } from '../common/auditoria';
import { horaChileADate, normalizarTexto } from '../common/texto';
import {
  CuentaBancaria,
  type Direccion,
  Documento,
  Empresa,
  Importacion,
  Movimiento,
} from '../entities';
import { mismaCuenta } from '../ingesta/conectores';
import { CartolaLeida, ErrorLectura, leerArchivo, RcvLeido } from './lectores';

export interface ResultadoImportacion {
  importacion: Importacion;
  cuentaCreada?: boolean;
  notasCreditoAplicadas?: number;
  /** Lectura por API que no trajo nada nuevo: no deja una importación vacía. */
  sinCambios?: boolean;
}

/** De dónde viene lo que se importa: un archivo subido o una lectura de la API (Emisso). */
interface Origen {
  tipo: 'archivo' | 'api';
  nombre: string;
  sha256: string;
  usuarioId: number | null;
}

export type LecturaApi =
  { clase: 'cartola'; cartola: CartolaLeida } | { clase: 'rcv'; rcv: RcvLeido };

@Injectable()
export class ImportacionService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async importar(
    empresaId: number,
    usuarioId: number,
    archivo: { originalname: string; buffer: Buffer },
  ): Promise<ResultadoImportacion> {
    const sha256 = createHash('sha256').update(archivo.buffer).digest('hex');
    const previa = await this.ds
      .getRepository(Importacion)
      .findOneBy({ empresaId, archivoSha256: sha256 });
    if (previa) {
      throw new ConflictException(
        `Este archivo ya se importó el ${previa.creadoEn.toISOString().slice(0, 10)} (importación #${previa.id})`,
      );
    }

    let leido: Awaited<ReturnType<typeof leerArchivo>>;
    try {
      leido = await leerArchivo(archivo.originalname, archivo.buffer);
    } catch (e) {
      if (e instanceof ErrorLectura) throw new BadRequestException(e.message);
      throw e;
    }

    const empresa = await this.ds
      .getRepository(Empresa)
      .findOneBy({ id: empresaId });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    const rutArchivo =
      leido.clase === 'cartola'
        ? leido.cartola.rutEmpresa
        : leido.rcv.rutEmpresa;
    if (rutArchivo && rutArchivo !== empresa.rut) {
      throw new BadRequestException(
        `El archivo es de la empresa ${rutArchivo} y se está importando en ${empresa.rut} (${empresa.razonSocial})`,
      );
    }

    const origen: Origen = {
      tipo: 'archivo',
      nombre: archivo.originalname,
      sha256,
      usuarioId,
    };
    return this.ds.transaction((em) =>
      leido.clase === 'cartola'
        ? this.guardarCartola(em, empresaId, origen, leido.cartola)
        : this.guardarRcv(em, empresaId, origen, leido.rcv),
    );
  }

  /**
   * Guarda lo que leyó un conector de la API. `nombre` identifica la lectura en el historial
   * (ej. "emisso:sii:ventas:2026-11"). Una lectura idéntica a una anterior se salta (null), y
   * una que no trae nada nuevo no deja rastro: el job lee cada 4 horas.
   */
  async importarDesdeApi(
    empresaId: number,
    nombre: string,
    lectura: LecturaApi,
  ): Promise<ResultadoImportacion | null> {
    const contenido =
      lectura.clase === 'cartola' ? lectura.cartola : lectura.rcv;
    const sha256 = createHash('sha256')
      .update(`${nombre}|${JSON.stringify(contenido)}`)
      .digest('hex');
    const repo = this.ds.getRepository(Importacion);
    if (await repo.existsBy({ empresaId, archivoSha256: sha256 })) return null;

    const empresa = await this.ds
      .getRepository(Empresa)
      .findOneBy({ id: empresaId });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    if (contenido.rutEmpresa && contenido.rutEmpresa !== empresa.rut) {
      throw new BadRequestException(
        `La conexión es de la empresa ${contenido.rutEmpresa} y no de ${empresa.rut} (${empresa.razonSocial})`,
      );
    }

    const origen: Origen = { tipo: 'api', nombre, sha256, usuarioId: null };
    try {
      return await this.ds.transaction((em) =>
        lectura.clase === 'cartola'
          ? this.guardarCartola(em, empresaId, origen, lectura.cartola)
          : this.guardarRcv(em, empresaId, origen, lectura.rcv),
      );
    } catch (e) {
      // La misma lectura entró en paralelo (job y botón a la vez): ya está guardada.
      if ((e as { code?: string }).code === '23505') return null;
      throw e;
    }
  }

  // ------------------------------------------------------------------ Cartolas

  private async guardarCartola(
    em: EntityManager,
    empresaId: number,
    origen: Origen,
    cartola: CartolaLeida,
  ): Promise<ResultadoImportacion> {
    const advertencias = [...cartola.advertencias];
    const { usuarioId } = origen;

    // La cuenta se identifica por banco + número del archivo; si no existe se crea.
    let cuenta =
      origen.tipo === 'api'
        ? await this.cuentaDeApi(em, empresaId, cartola, advertencias)
        : await em.findOneBy(CuentaBancaria, {
            empresaId,
            banco: cartola.banco,
            numero: cartola.numeroCuenta,
          });
    const cuentaCreada = !cuenta;
    if (!cuenta) {
      cuenta = await em.save(
        em.create(CuentaBancaria, {
          empresaId,
          banco: cartola.banco,
          numero: cartola.numeroCuenta,
          alias: cartola.aliasCuenta,
          moneda: 'CLP',
          activa: true,
        }),
      );
      advertencias.push(
        `Se creó la cuenta ${cartola.banco} N° ${cartola.numeroCuenta}`,
      );
    }

    advertencias.push(
      ...(await this.revisarContinuidad(em, cuenta.id, cartola)),
    );

    const movimientos = await this.filtrarPorCorte(
      em,
      cuenta,
      origen,
      cartola,
      advertencias,
    );

    const importacion = await em.save(
      em.create(Importacion, {
        empresaId,
        cuentaId: cuenta.id,
        tipo: 'cartola',
        lector: cartola.lector,
        archivoNombre: origen.nombre,
        archivoSha256: origen.sha256,
        origen: origen.tipo,
        periodoDesde: cartola.desde,
        periodoHasta: cartola.hasta,
        nCartola: cartola.nCartola,
        saldoInicial: cartola.saldoInicial,
        saldoFinal: cartola.saldoFinal,
        filasLeidas: movimientos.length,
        filasNuevas: 0,
        filasDuplicadas: 0,
        advertencias: [],
        usuarioId,
      }),
    );

    // Contrapartes conocidas por RUT (las glosas casi nunca lo traen, pero si viene se usa).
    const ruts = [
      ...new Set(
        movimientos
          .map((m) => m.rutContraparte)
          .filter((r): r is string => !!r),
      ),
    ];
    const contrapartePorRut = new Map<string, number>();
    if (ruts.length) {
      const filas: { id: number; rut: string }[] = await em.query(
        'SELECT id, rut FROM contraparte WHERE empresa_id = $1 AND rut = ANY($2)',
        [empresaId, ruts],
      );
      for (const f of filas) contrapartePorRut.set(f.rut, f.id);
    }

    const valores = movimientos.map((m) => {
      const glosaNormalizada = normalizarTexto(m.glosa);
      return {
        empresaId,
        cuentaId: cuenta.id,
        importacionId: importacion.id,
        fecha: m.fecha,
        orden: m.orden,
        monto: m.monto,
        saldo: m.saldo,
        glosa: m.glosa,
        glosaNormalizada,
        nOperacion: m.nOperacion,
        sucursal: m.sucursal,
        contraparteTexto: m.contraparteTexto,
        rutContraparte: m.rutContraparte,
        contraparteId: m.rutContraparte
          ? (contrapartePorRut.get(m.rutContraparte) ?? null)
          : null,
        ignorado: false,
        montoConciliado: 0,
        estado: 'pendiente' as const,
        nota: null,
        idExterno: m.idExterno ?? null,
        // El saldo corrido hace única cada fila aunque haya dos pagos iguales el mismo día,
        // y es el mismo si la fila vuelve a venir en otra cartola que se traslapa. Por la API
        // manda la clave del conector, que no depende del saldo.
        hashDedup: m.claveDedup
          ? sha([cuenta.id, 'api', m.claveDedup])
          : sha([
              cuenta.id,
              m.fecha,
              m.monto,
              glosaNormalizada,
              m.nOperacion ?? '',
              m.saldo ?? '',
              m.saldo === null ? m.orden : '',
            ]),
      };
    });

    const insertados = valores.length
      ? await em
          .createQueryBuilder()
          .insert()
          .into(Movimiento)
          .values(valores)
          .orIgnore()
          .returning('id')
          .execute()
      : { raw: [] };
    const nuevas = (insertados.raw as unknown[]).length;
    if (origen.tipo === 'api' && nuevas === 0) {
      await em.delete(Importacion, importacion.id);
      return { importacion, cuentaCreada, sinCambios: true };
    }

    importacion.filasNuevas = nuevas;
    importacion.filasDuplicadas = valores.length - nuevas;
    importacion.advertencias = advertencias;
    await em.save(importacion);

    await auditar(em, {
      empresaId,
      usuarioId,
      accion: 'importacion.crear',
      entidad: 'importacion',
      entidadId: importacion.id,
      detalle: {
        origen: origen.tipo,
        tipo: 'cartola',
        cuentaId: cuenta.id,
        nuevas,
        duplicadas: importacion.filasDuplicadas,
      },
    });
    return { importacion, cuentaCreada };
  }

  /**
   * Cuenta de una lectura de Emisso. Emisso escribe el número distinto que los archivos (con
   * código de producto o ceros de relleno), así que se compara por dígitos. Si no calza con
   * ninguna pero la empresa tiene una sola cuenta de ese banco, se asume esa.
   */
  private async cuentaDeApi(
    em: EntityManager,
    empresaId: number,
    cartola: CartolaLeida,
    advertencias: string[],
  ): Promise<CuentaBancaria | null> {
    const delBanco = await em.findBy(CuentaBancaria, {
      empresaId,
      banco: cartola.banco,
    });
    const iguales = delBanco.filter((c) =>
      mismaCuenta(c.numero, cartola.numeroCuenta),
    );
    if (iguales.length === 1) return iguales[0];
    const activas = delBanco.filter((c) => c.activa);
    if (iguales.length === 0 && activas.length === 1) {
      advertencias.push(
        `La cuenta ${cartola.numeroCuenta} de Emisso se asoció a la cuenta N° ${activas[0].numero}, la única de ese banco`,
      );
      return activas[0];
    }
    return null;
  }

  /**
   * Un día entra por una sola fuente: antes de `api_desde` por archivo, desde esa fecha por la
   * API. La primera lectura de la API fija el corte en el día siguiente al último movimiento
   * que ya tenía la cuenta, para no duplicar lo que se subió a mano.
   */
  private async filtrarPorCorte(
    em: EntityManager,
    cuenta: CuentaBancaria,
    origen: Origen,
    cartola: CartolaLeida,
    advertencias: string[],
  ) {
    if (origen.tipo === 'api' && !cuenta.apiDesde) {
      const [{ ultima }]: { ultima: string | null }[] = await em.query(
        `SELECT to_char(max(fecha) + 1, 'YYYY-MM-DD') AS ultima FROM movimiento WHERE cuenta_id = $1`,
        [cuenta.id],
      );
      cuenta.apiDesde = ultima ?? cartola.desde;
      await em.update(CuentaBancaria, cuenta.id, {
        apiDesde: cuenta.apiDesde,
      });
      advertencias.push(
        `Desde el ${cuenta.apiDesde} los movimientos de esta cuenta entran por Emisso; lo anterior, por archivo`,
      );
    }
    const corte = cuenta.apiDesde;
    if (!corte) return cartola.movimientos;
    const quedan = cartola.movimientos.filter((m) =>
      origen.tipo === 'api' ? m.fecha >= corte : m.fecha < corte,
    );
    const omitidos = cartola.movimientos.length - quedan.length;
    if (omitidos > 0)
      advertencias.push(
        origen.tipo === 'api'
          ? `${omitidos} movimientos anteriores al ${corte} no se importaron: esos días se cargan por archivo`
          : `${omitidos} movimientos desde el ${corte} no se importaron: esos días los trae Emisso`,
      );
    return quedan;
  }

  /** Avisa si falta una cartola entre la última importada y esta (por N° de cartola o por saldo). */
  private async revisarContinuidad(
    em: EntityManager,
    cuentaId: number,
    cartola: CartolaLeida,
  ): Promise<string[]> {
    const previas = await em.find(Importacion, {
      where: { cuentaId, tipo: 'cartola' },
      order: { periodoHasta: 'DESC' },
    });
    if (previas.length === 0) return [];

    if (cartola.nCartola !== null && previas.some((p) => p.nCartola !== null)) {
      const numeros = new Set(previas.map((p) => p.nCartola));
      const anterior = cartola.nCartola - 1;
      const max = Math.max(...previas.map((p) => p.nCartola ?? 0));
      if (cartola.nCartola > max && !numeros.has(anterior)) {
        return [
          `Falta importar la cartola N° ${anterior} (la última importada es la N° ${max})`,
        ];
      }
      return [];
    }
    // Sin N° de cartola (Banco de Chile) la cadena se comprueba por saldos Y fechas (un mes puede
    // empezar y terminar en el mismo saldo, ej. $0, y los saldos solos darían falsos enlaces).
    // Está completa si la cartola continúa a una importada, la antecede, o se traslapa con ellas.
    if (cartola.saldoInicial !== null) {
      const saldoInicial = cartola.saldoInicial;
      const enlaza =
        previas.some(
          (p) =>
            (p.saldoFinal === saldoInicial &&
              cartola.desde >= (p.periodoHasta ?? '')) ||
            (cartola.saldoFinal !== null &&
              p.saldoInicial === cartola.saldoFinal &&
              cartola.hasta <= (p.periodoDesde ?? '')),
        ) ||
        // Traslape con lo posterior: empieza en un saldo que la cuenta ya tenía en esa fecha o antes.
        (await em.existsBy(Movimiento, {
          cuentaId,
          saldo: saldoInicial,
          fecha: LessThanOrEqual(cartola.desde),
        })) ||
        // Traslape con lo anterior: termina en un saldo que la cuenta ya tiene desde esa fecha.
        (cartola.saldoFinal !== null &&
          (await em.existsBy(Movimiento, {
            cuentaId,
            saldo: cartola.saldoFinal,
            fecha: MoreThanOrEqual(cartola.hasta),
          })));
      if (!enlaza) {
        return [
          'El saldo inicial no coincide con el de ninguna cartola importada: puede faltar una',
        ];
      }
    }
    return [];
  }

  // ------------------------------------------------------------------ RCV

  private async guardarRcv(
    em: EntityManager,
    empresaId: number,
    origen: Origen,
    rcv: RcvLeido,
  ): Promise<ResultadoImportacion> {
    const { usuarioId } = origen;
    const direccion: Direccion =
      rcv.tipo === 'rcv_compra' ? 'recibido' : 'emitido';

    const importacion = await em.save(
      em.create(Importacion, {
        empresaId,
        cuentaId: null,
        tipo: rcv.tipo,
        lector: rcv.lector,
        archivoNombre: origen.nombre,
        archivoSha256: origen.sha256,
        origen: origen.tipo,
        periodoDesde: rcv.desde,
        periodoHasta: rcv.hasta,
        nCartola: null,
        saldoInicial: null,
        saldoFinal: null,
        filasLeidas: rcv.documentos.length,
        filasNuevas: 0,
        filasDuplicadas: 0,
        advertencias: [],
        usuarioId,
      }),
    );

    const contrapartes = await this.registrarContrapartes(em, empresaId, rcv);

    const valores = rcv.documentos.map((d) => ({
      empresaId,
      importacionId: importacion.id,
      direccion,
      tipoDte: d.tipoDte,
      folio: d.folio,
      rutContraparte: d.rutContraparte,
      razonSocial: d.razonSocial,
      contraparteId: contrapartes.get(d.rutContraparte) ?? null,
      fechaEmision: d.fechaEmision,
      fechaRecepcion: d.fechaRecepcion
        ? horaChileADate(d.fechaRecepcion)
        : null,
      montoExento: d.montoExento,
      montoNeto: d.montoNeto,
      montoIva: d.montoIva,
      montoTotal: d.montoTotal,
      refTipoDte: d.refTipoDte,
      refFolio: d.refFolio,
      saldoPendiente: d.montoTotal,
      estado: 'pendiente' as const,
    }));

    // Un documento ya importado (mismo RUT, tipo y folio) no se duplica ni se pisa: puede tener
    // conciliaciones encima. Pasa al volver a bajar el RCV de un mes en curso.
    const insertados = valores.length
      ? await em
          .createQueryBuilder()
          .insert()
          .into(Documento)
          .values(valores)
          .orIgnore()
          .returning('id')
          .execute()
      : { raw: [] };
    const nuevas = (insertados.raw as unknown[]).length;
    // Estado inicial correcto: los de contrapartes con categoría (ej. COPEC) quedan 'excluido'.
    await em.query(
      'SELECT recalcular_documentos(array(SELECT id FROM documento WHERE importacion_id = $1))',
      [importacion.id],
    );

    const notasCreditoAplicadas = await this.aplicarNotasCreditoReferenciadas(
      em,
      empresaId,
    );
    if (origen.tipo === 'api' && nuevas === 0) {
      await em.delete(Importacion, importacion.id);
      return { importacion, notasCreditoAplicadas, sinCambios: true };
    }

    importacion.filasNuevas = nuevas;
    importacion.filasDuplicadas = valores.length - nuevas;
    importacion.advertencias = rcv.advertencias;
    await em.save(importacion);

    await auditar(em, {
      empresaId,
      usuarioId,
      accion: 'importacion.crear',
      entidad: 'importacion',
      entidadId: importacion.id,
      detalle: {
        origen: origen.tipo,
        tipo: rcv.tipo,
        periodo: rcv.periodo,
        nuevas,
        duplicadas: importacion.filasDuplicadas,
        notasCreditoAplicadas,
      },
    });
    return { importacion, notasCreditoAplicadas };
  }

  /** Crea (o completa) clientes y proveedores a partir del RCV. Devuelve RUT → id. */
  private async registrarContrapartes(
    em: EntityManager,
    empresaId: number,
    rcv: RcvLeido,
  ) {
    const tipo = rcv.tipo === 'rcv_compra' ? 'proveedor' : 'cliente';
    const porRut = new Map<string, string>();
    for (const d of rcv.documentos)
      if (!porRut.has(d.rutContraparte))
        porRut.set(d.rutContraparte, d.razonSocial);
    if (porRut.size === 0) return new Map<string, number>();

    // Si ya era proveedor y ahora aparece como cliente (o al revés) queda como cliente_proveedor.
    const filas: { id: number; rut: string }[] = await em.query(
      `INSERT INTO contraparte (empresa_id, rut, nombre, tipo)
       SELECT $1, x.rut, x.nombre, $4
         FROM unnest($2::text[], $3::text[]) AS x(rut, nombre)
       ON CONFLICT (empresa_id, rut) WHERE rut IS NOT NULL DO UPDATE
          SET tipo = CASE WHEN contraparte.tipo IN ('cliente', 'proveedor') AND contraparte.tipo <> EXCLUDED.tipo
                          THEN 'cliente_proveedor' ELSE contraparte.tipo END
       RETURNING id, rut`,
      [empresaId, [...porRut.keys()], [...porRut.values()], tipo],
    );
    return new Map(filas.map((f) => [f.rut, f.id]));
  }

  /**
   * Notas de crédito de venta que traen la factura referenciada: se aplican solas.
   * No se reaplica una que el usuario deshizo a mano (por eso se revisa cualquier aplicación previa).
   * Se recorre una a una para que dos notas sobre la misma factura no la dejen bajo cero.
   */
  private async aplicarNotasCreditoReferenciadas(
    em: EntityManager,
    empresaId: number,
  ): Promise<number> {
    const candidatas: { nc_id: string; doc_id: string }[] = await em.query(
      `SELECT nc.id AS nc_id, f.id AS doc_id
         FROM documento nc
         JOIN documento f ON f.empresa_id = nc.empresa_id
                         AND f.direccion = nc.direccion
                         AND f.rut_contraparte = nc.rut_contraparte
                         AND f.tipo_dte = nc.ref_tipo_dte
                         AND f.folio = nc.ref_folio
        WHERE nc.empresa_id = $1
          AND nc.tipo_dte = 61
          AND nc.ref_folio IS NOT NULL
          AND nc.saldo_pendiente > 0
          AND NOT EXISTS (SELECT 1 FROM nota_credito_aplicacion n WHERE n.nota_credito_id = nc.id)
        ORDER BY nc.fecha_emision, nc.id`,
      [empresaId],
    );

    let aplicadas = 0;
    for (const c of candidatas) {
      const filas: { id: number }[] = await em.query(
        `INSERT INTO nota_credito_aplicacion (empresa_id, nota_credito_id, documento_id, monto, origen)
         SELECT $1, nc.id, f.id, LEAST(nc.saldo_pendiente, f.saldo_pendiente), 'auto'
           FROM documento nc, documento f
          WHERE nc.id = $2 AND f.id = $3 AND LEAST(nc.saldo_pendiente, f.saldo_pendiente) > 0
         RETURNING id`,
        [empresaId, c.nc_id, c.doc_id],
      );
      if (filas.length > 0) {
        await recalcular(em, {
          documentos: [Number(c.nc_id), Number(c.doc_id)],
        });
        aplicadas++;
      }
    }
    return aplicadas;
  }

  listar(empresaId: number) {
    return this.ds
      .getRepository(Importacion)
      .find({ where: { empresaId }, order: { creadoEn: 'DESC' } });
  }
}

function sha(partes: (string | number)[]): string {
  return createHash('sha256').update(partes.join('|')).digest('hex');
}
