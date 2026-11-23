import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UmbralEntity } from '../models/umbral.entity';
import {
  FRESCURA,
  MARGENES,
  UMBRALES_DEFECTO,
  UNIDADES,
  Umbral,
  VARIABLES,
  ZONAS,
  ZONAS_IDS,
  ZonaId,
} from '../viveros.config';
import type { UmbralesZona } from '../lib/analisis';

const VIGENCIA_MS = 60_000;

/**
 * Rangos permitidos por zona y variable. Es la única fuente para el dashboard, el
 * informe semanal y el monitor de alarmas (que los lee con `GET /config`).
 */
@Injectable()
export class UmbralesService {
  private readonly logger = new Logger(UmbralesService.name);
  private cache: { umbrales: Umbral[]; hasta: number } | null = null;
  private avisoSinTabla = false;
  /** Cambia con cada actualización; invalida los resúmenes cacheados. */
  version = 0;

  constructor(
    @InjectRepository(UmbralEntity)
    private readonly repo: Repository<UmbralEntity>,
  ) {}

  async obtener(): Promise<Umbral[]> {
    if (this.cache && this.cache.hasta > Date.now()) return this.cache.umbrales;
    let umbrales = UMBRALES_DEFECTO;
    try {
      const filas = await this.repo.find();
      // Lo que no esté en la tabla conserva el valor por defecto.
      umbrales = UMBRALES_DEFECTO.map((d) => {
        const f = filas.find((x) => x.zona === d.zona && x.variable === d.variable);
        return f
          ? { ...d, min: f.min === null ? null : Number(f.min), max: f.max === null ? null : Number(f.max), alerta: f.alerta }
          : d;
      });
      this.avisoSinTabla = false;
    } catch (error) {
      if (!this.avisoSinTabla) {
        this.logger.warn(
          `No se pudo leer viveros_umbrales (${(error as Error).message}); se usan los valores por defecto`,
        );
        this.avisoSinTabla = true;
      }
    }
    this.cache = { umbrales, hasta: Date.now() + VIGENCIA_MS };
    return umbrales;
  }

  async porZona(): Promise<Record<ZonaId, UmbralesZona>> {
    const umbrales = await this.obtener();
    const r = {} as Record<ZonaId, UmbralesZona>;
    for (const z of ZONAS_IDS) {
      r[z] = {} as UmbralesZona;
      for (const v of VARIABLES) {
        r[z][v] = umbrales.find((u) => u.zona === z && u.variable === v)!;
      }
    }
    return r;
  }

  /** Respuesta de `GET /config`. */
  async config() {
    const porZona = await this.porZona();
    return {
      zonas: ZONAS_IDS.map((id) => {
        const { nombre, controlada, origen } = ZONAS[id];
        return {
          id,
          nombre,
          controlada,
          origen,
          variables: Object.fromEntries(
            VARIABLES.map((v) => [
              v,
              {
                min: porZona[id][v].min,
                max: porZona[id][v].max,
                alerta: porZona[id][v].alerta,
                unidad: UNIDADES[v],
                margen: MARGENES[v],
              },
            ]),
          ),
        };
      }),
      frescura: FRESCURA,
    };
  }

  async actualizar(cambios: Umbral[]): Promise<void> {
    for (const c of cambios) {
      if (c.min !== null && c.max !== null && c.min >= c.max) {
        throw new BadRequestException(
          `${ZONAS[c.zona].nombre} · ${c.variable}: el mínimo debe ser menor que el máximo`,
        );
      }
    }
    await this.repo.save(
      cambios.map((c) => ({ ...c, actualizado: new Date() })),
    );
    this.cache = null;
    this.version++;
    this.logger.log(`Umbrales actualizados: ${cambios.length}`);
  }
}
