import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BASE_POR_DEFECTO = 'https://connect.emisso.ai/api/v1';

/** Error de la API de Emisso: `{ error: { code, message } }` con su status HTTP. */
export class ErrorEmisso extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reintentarEn: number | null = null,
    /** `suggested_fix` de Emisso: qué hacer para resolverlo. */
    readonly sugerencia: string | null = null,
  ) {
    super(message);
  }

  /** La credencial del banco o del SII ya no sirve: hay que pedirla de nuevo con un enlace. */
  get pideReconectar(): boolean {
    return this.code === 'connection_credential_required';
  }
}

/** Errores pasajeros: se reintenta con espera. El resto se informa tal cual. */
const REINTENTABLES = new Set([
  'rate_limited',
  'connection_busy',
  'service_unavailable',
  'upstream_error',
]);

export interface SesionConexion {
  id: string;
  mode: string;
  connector_code: string | null;
  connection_id: string | null;
  status: 'pending' | 'consumed' | 'revoked' | 'expired';
  resulting_connection_id: string | null;
  allowed_origins: string[];
  expires_at: string;
  /** Solo al crearla: el token en claro no se puede volver a pedir. */
  url?: string;
}

export interface ConexionEmisso {
  id: string;
  connector: string;
  display_name: string | null;
  empresa_rut: string | null;
  status: string;
  credential_scheme: string | null;
}

/**
 * Cliente mínimo de la API REST de Emisso (https://connect.emisso.ai/docs/operar/api-control).
 * Toda respuesta viene como `{ data }` y todo error como `{ error: { code, message } }`.
 */
@Injectable()
export class EmissoClient {
  private readonly logger = new Logger(EmissoClient.name);
  private readonly apiKey: string | undefined;
  private readonly base: string;
  /** Pausa entre reintentos; los tests la ponen en 0. */
  esperaBaseMs = 1000;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('EMISSO_API_KEY') || undefined;
    this.base = (
      config.get<string>('EMISSO_BASE_URL') || BASE_POR_DEFECTO
    ).replace(/\/+$/, '');
  }

  get configurado(): boolean {
    return !!this.apiKey;
  }

  /** `POST /v1/tools/{id}/execute`. Las tools de un sistema conectado exigen la conexión. */
  ejecutar<T>(
    toolId: string,
    input: Record<string, unknown>,
    conexion?: string,
  ): Promise<T> {
    return this.pedir<T>('POST', `/tools/${toolId}/execute`, {
      cuerpo: { input },
      conexion,
    });
  }

  /** Recorre todas las páginas de una tool de consulta (paginada con `cursor`) y junta `campo`. */
  async paginar<T>(
    toolId: string,
    input: Record<string, unknown>,
    campo: string,
    conexion: string,
  ): Promise<{ filas: T[]; ultima: Record<string, unknown> }> {
    const filas: T[] = [];
    let cursor: string | null = null;
    let ultima: Record<string, unknown> = {};
    // Tope de seguridad: 100 páginas de 500 filas sobran para un mes de una pyme.
    for (let pagina = 0; pagina < 100; pagina++) {
      ultima = await this.ejecutar<Record<string, unknown>>(
        toolId,
        { ...input, limit: 500, ...(cursor ? { cursor } : {}) },
        conexion,
      );
      filas.push(...((ultima[campo] as T[] | undefined) ?? []));
      cursor = (ultima.cursor as string | null | undefined) ?? null;
      if (!cursor) return { filas, ultima };
    }
    throw new ErrorEmisso(
      500,
      'demasiadas_paginas',
      `${toolId} devolvió más de 100 páginas`,
    );
  }

  crearSesion(cuerpo: Record<string, unknown>): Promise<SesionConexion> {
    return this.pedir<SesionConexion>('POST', '/connect_sessions', { cuerpo });
  }

  listarSesiones(): Promise<SesionConexion[]> {
    return this.pedir<SesionConexion[]>('GET', '/connect_sessions');
  }

  listarConexiones(): Promise<ConexionEmisso[]> {
    return this.pedir<ConexionEmisso[]>('GET', '/connections');
  }

  /** Encola la sincronización de esos meses con todos los alcances habilitados. */
  async pedirSync(conexion: string, periodos: string[]): Promise<string[]> {
    const r = await this.pedir<{ job_ids: string[] }>(
      'POST',
      `/connections/${conexion}/syncs`,
      { cuerpo: { periodos } },
    );
    return r.job_ids;
  }

  private async pedir<T>(
    metodo: 'GET' | 'POST',
    ruta: string,
    opciones: { cuerpo?: unknown; conexion?: string } = {},
  ): Promise<T> {
    if (!this.apiKey)
      throw new ErrorEmisso(
        503,
        'no_configurado',
        'Falta EMISSO_API_KEY en la configuración de la API',
      );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };
    if (opciones.cuerpo !== undefined)
      headers['Content-Type'] = 'application/json';
    if (opciones.conexion) headers['X-Connect-Connection'] = opciones.conexion;

    for (let intento = 1; ; intento++) {
      let respuesta: Response;
      try {
        respuesta = await fetch(this.base + ruta, {
          method: metodo,
          headers,
          body:
            opciones.cuerpo === undefined
              ? undefined
              : JSON.stringify(opciones.cuerpo),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (e) {
        if (intento < 3) {
          await this.esperar(intento, null);
          continue;
        }
        throw new ErrorEmisso(
          503,
          'sin_conexion',
          `No se pudo contactar a Emisso: ${(e as Error).message}`,
        );
      }

      const texto = await respuesta.text();
      let json: {
        data?: T;
        error?: { code?: string; message?: string; suggested_fix?: string };
      } = {};
      try {
        json = texto ? (JSON.parse(texto) as typeof json) : {};
      } catch {
        // Respuesta no JSON (ej. un proxy caído): se informa con el status.
      }
      if (respuesta.ok) return json.data as T;

      const reintentarEn = Number(respuesta.headers.get('retry-after')) || null;
      const error = new ErrorEmisso(
        respuesta.status,
        json.error?.code ?? `http_${respuesta.status}`,
        json.error?.message ?? `Emisso respondió ${respuesta.status}`,
        reintentarEn,
        json.error?.suggested_fix ?? null,
      );
      // Un 429 por cupo agotado (quota_exceeded) no se arregla esperando unos segundos.
      if (REINTENTABLES.has(error.code) && intento < 3) {
        this.logger.warn(
          `${metodo} ${ruta}: ${error.code}, reintento ${intento}`,
        );
        await this.esperar(intento, reintentarEn);
        continue;
      }
      throw error;
    }
  }

  private esperar(intento: number, segundos: number | null) {
    const ms = Math.min(
      segundos !== null ? segundos * 1000 : this.esperaBaseMs * 2 ** intento,
      30_000,
    );
    return new Promise((r) => setTimeout(r, this.esperaBaseMs ? ms : 0));
  }
}
