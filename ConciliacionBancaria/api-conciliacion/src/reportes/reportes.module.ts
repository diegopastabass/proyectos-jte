import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { DataSource } from 'typeorm';
import { consultar } from '../common/auditoria';

/** Todos los reportes van por la fecha del movimiento bancario (base caja). */
class FiltroReporteDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() cuentaId?: number;
  @IsOptional() @Type(() => Number) @IsInt() proyectoId?: number;
}

interface Montos {
  /** Salidas de plata (cargos), en positivo. */
  cargos: number;
  /** Entradas (abonos). */
  abonos: number;
  movimientos: number;
}

const FILTRO_MOVIMIENTO = `m.empresa_id = $1
  AND ($2::date IS NULL OR m.fecha >= $2) AND ($3::date IS NULL OR m.fecha <= $3)
  AND ($4::int IS NULL OR m.cuenta_id = $4) AND ($5::int IS NULL OR m.proyecto_id = $5)`;

@Injectable()
export class ReportesService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private params(empresaId: number, f: FiltroReporteDto) {
    return [
      empresaId,
      f.desde ?? null,
      f.hasta ?? null,
      f.cuentaId ?? null,
      f.proyectoId ?? null,
    ];
  }

  /**
   * Cuánto se gastó y se recibió por categoría (ej. total en peajes, total en AWS), mes a mes.
   * Además: lo conciliado con facturas y lo que falta conciliar, para que los totales cuadren
   * con la cartola.
   */
  async categorias(empresaId: number, f: FiltroReporteDto) {
    const params = this.params(empresaId, f);
    const [filas, [documentos], [porConciliar]] = await Promise.all([
      consultar<{
        id: number;
        nombre: string;
        tipo: string;
        mes: string;
        cargos: number;
        abonos: number;
        movimientos: number;
      }>(
        this.ds,
        `SELECT cat.id, cat.nombre, cat.tipo, to_char(m.fecha, 'YYYY-MM') AS mes,
                COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto < 0), 0)::float8 AS cargos,
                COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto > 0), 0)::float8 AS abonos,
                count(DISTINCT m.id)::int AS movimientos
           FROM conciliacion_linea l
           JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
           JOIN movimiento m ON m.id = l.movimiento_id
           JOIN categoria cat ON cat.id = l.categoria_id
          WHERE ${FILTRO_MOVIMIENTO}
          GROUP BY cat.id, cat.nombre, cat.tipo, mes`,
        params,
      ),
      consultar<Montos>(
        this.ds,
        `SELECT COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto < 0), 0)::float8 AS cargos,
                COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto > 0), 0)::float8 AS abonos,
                count(DISTINCT m.id)::int AS movimientos
           FROM conciliacion_linea l
           JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
           JOIN movimiento m ON m.id = l.movimiento_id
          WHERE l.documento_id IS NOT NULL AND ${FILTRO_MOVIMIENTO}`,
        params,
      ),
      consultar<Montos>(
        this.ds,
        `SELECT COALESCE(sum(abs(m.monto) - m.monto_conciliado) FILTER (WHERE m.monto < 0), 0)::float8 AS cargos,
                COALESCE(sum(abs(m.monto) - m.monto_conciliado) FILTER (WHERE m.monto > 0), 0)::float8 AS abonos,
                count(*)::int AS movimientos
           FROM movimiento m
          WHERE NOT m.ignorado AND m.monto_conciliado < abs(m.monto) AND ${FILTRO_MOVIMIENTO}`,
        params,
      ),
    ]);

    const porCategoria = new Map<
      number,
      Montos & {
        id: number;
        nombre: string;
        tipo: string;
        meses: Record<string, { cargos: number; abonos: number }>;
      }
    >();
    for (const r of filas) {
      let c = porCategoria.get(r.id);
      if (!c) {
        c = {
          id: r.id,
          nombre: r.nombre,
          tipo: r.tipo,
          cargos: 0,
          abonos: 0,
          movimientos: 0,
          meses: {},
        };
        porCategoria.set(r.id, c);
      }
      c.cargos += r.cargos;
      c.abonos += r.abonos;
      c.movimientos += r.movimientos;
      c.meses[r.mes] = { cargos: r.cargos, abonos: r.abonos };
    }
    return {
      meses: [...new Set(filas.map((r) => r.mes))].sort(),
      categorias: [...porCategoria.values()].sort(
        (a, b) => b.cargos + b.abonos - (a.cargos + a.abonos),
      ),
      documentos,
      porConciliar,
    };
  }

  /** Lo pagado a cada proveedor y cobrado a cada cliente con factura (líneas a documentos). */
  async contrapartes(empresaId: number, f: FiltroReporteDto) {
    return consultar<{
      rut: string;
      razonSocial: string;
      pagado: number;
      cobrado: number;
      documentos: number;
      movimientos: number;
    }>(
      this.ds,
      `SELECT d.rut_contraparte AS rut, max(d.razon_social) AS "razonSocial",
              COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto < 0), 0)::float8 AS pagado,
              COALESCE(sum(l.monto_aplicado) FILTER (WHERE m.monto > 0), 0)::float8 AS cobrado,
              count(DISTINCT d.id)::int AS documentos,
              count(DISTINCT m.id)::int AS movimientos
         FROM conciliacion_linea l
         JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
         JOIN movimiento m ON m.id = l.movimiento_id
         JOIN documento d ON d.id = l.documento_id
        WHERE ${FILTRO_MOVIMIENTO}
        GROUP BY d.rut_contraparte
        ORDER BY sum(l.monto_aplicado) DESC
        LIMIT 500`,
      this.params(empresaId, f),
    );
  }
}

@Controller('empresas/:empresaId/reportes')
export class ReportesController {
  constructor(private readonly servicio: ReportesService) {}

  @Get('categorias')
  categorias(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroReporteDto,
  ) {
    return this.servicio.categorias(empresaId, filtro);
  }

  @Get('contrapartes')
  contrapartes(
    @Param('empresaId', ParseIntPipe) empresaId: number,
    @Query() filtro: FiltroReporteDto,
  ) {
    return this.servicio.contrapartes(empresaId, filtro);
  }
}

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
