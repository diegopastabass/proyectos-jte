import { COLOR_ZONA, DECIMALES, NOMBRE_VARIABLE, TOPE_MIN, UNIDAD, type Variable } from "../config";
import {
  COLOR_ESTADO,
  COLOR_NEUTRO,
  ICONO_ZONA,
  TEXTO_VALOR,
  TEXTO_ZONA,
  porcentajeEnRango,
  tonoValor,
  tonoZona,
} from "../lib/estados";
import { fechaHoraChile } from "../lib/fechas";
import { conUnidad, formatoDuracion, formatoNumero, textoRango } from "../lib/formato";
import type { EstadoZonaApi, PuntoSerie, ZonaConfig } from "../lib/tipos";
import EstadoDato from "./EstadoDato";
import RangoBar from "./RangoBar";
import Sparkline from "./Sparkline";

const SPAN_MINIMO: Record<Variable, number> = { t: 4, hr: 10, vpd: 0.4 };

interface ZonaCardProps {
  zona: EstadoZonaApi;
  config: ZonaConfig;
  serie: PuntoSerie[];
}

function Medida({
  variable,
  zona,
  config,
  serie,
}: {
  variable: "t" | "hr";
  zona: EstadoZonaApi;
  config: ZonaConfig;
  serie: PuntoSerie[];
}) {
  const actual = zona[variable];
  const rango = config.variables[variable];
  const hoy = zona.hoy[variable];
  const tono = zona.controlada ? tonoValor(actual.estado) : "neutro";
  const color = tono === "neutro" ? COLOR_NEUTRO : COLOR_ESTADO[tono];
  const ahora = Date.now();
  const sinDatos = zona.frescura === "sin_datos";

  return (
    <div className="medida">
      <div className="small text-body-secondary fw-semibold text-uppercase">{NOMBRE_VARIABLE[variable]}</div>
      <div className="d-flex align-items-baseline gap-2 flex-wrap">
        <span className="valor-grande" style={{ color: sinDatos ? COLOR_NEUTRO : color }}>
          {conUnidad(actual.valor, UNIDAD[variable], DECIMALES[variable])}
        </span>
        {zona.controlada && !sinDatos && (
          <span className="small fw-semibold" style={{ color }}>
            {TEXTO_VALOR[actual.estado]}
          </span>
        )}
      </div>
      <RangoBar
        valor={actual.valor}
        hoyMin={hoy?.min}
        hoyMax={hoy?.max}
        rangoMin={zona.controlada ? rango.min : null}
        rangoMax={zona.controlada ? rango.max : null}
        decimales={DECIMALES[variable]}
        spanMinimo={SPAN_MINIMO[variable]}
        limites={variable === "hr" ? [0, 100] : undefined}
        color={color}
      />
      {zona.controlada && (
        <div className="small text-body-secondary">
          Rango permitido: {textoRango(rango.min, rango.max, UNIDAD[variable])}
        </div>
      )}
      <Sparkline
        puntos={serie.map((p) => ({ ms: Date.parse(p.time), v: p[variable] }))}
        desde={ahora - 24 * 3600_000}
        hasta={ahora}
        rangoMin={zona.controlada ? rango.min : null}
        rangoMax={zona.controlada ? rango.max : null}
        color={COLOR_ZONA[zona.id]}
        topeMin={TOPE_MIN[zona.id]}
      />
      <div className="d-flex justify-content-between text-body-secondary" style={{ fontSize: "0.7rem" }}>
        <span>hace 24 h</span>
        <span>ahora</span>
      </div>
      {actual.pegadoDesde && (
        <div className="aviso-sensor">
          <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
          Sin variación desde el {fechaHoraChile(actual.pegadoDesde)}: revisar el sensor.
        </div>
      )}
    </div>
  );
}

/** Tarjeta de una zona: valores actuales con contexto, lo de hoy y el estado del equipo. */
function ZonaCard({ zona, config, serie }: ZonaCardProps) {
  const tono = tonoZona(zona.estado);
  const color = tono === "neutro" ? COLOR_NEUTRO : COLOR_ESTADO[tono];
  const vpd = config.variables.vpd;
  // En el exterior (referencia) el VPD se informa sin color de estado.
  const tonoVpd = zona.controlada ? tonoValor(zona.vpd.estado) : "neutro";
  const colorVpd = tonoVpd === "neutro" ? COLOR_NEUTRO : COLOR_ESTADO[tonoVpd];
  const pct = porcentajeEnRango(zona.hoy.minutos);

  return (
    <section
      id={`zona-${zona.id}`}
      className="tarjeta zona-card h-100"
      style={{ borderTopColor: COLOR_ZONA[zona.id] }}
      aria-label={zona.nombre}
    >
      <header className="d-flex align-items-start justify-content-between gap-2 mb-2">
        <div className="min-w-0">
          <h2 className="h5 mb-0 text-truncate">{zona.nombre}</h2>
          <div className="small text-body-secondary">{zona.origen}</div>
        </div>
        <div className="d-flex flex-column align-items-end gap-1">
          <span className="badge rounded-pill d-inline-flex align-items-center gap-1" style={{ background: color }}>
            <i className={`bi ${ICONO_ZONA[zona.estado]}`} aria-hidden="true" />
            {TEXTO_ZONA[zona.estado]}
          </span>
          <EstadoDato time={zona.ultimo} frescura={zona.frescura} />
        </div>
      </header>

      <div className="row g-3">
        <div className="col-12 col-sm-6">
          <Medida variable="t" zona={zona} config={config} serie={serie} />
        </div>
        <div className="col-12 col-sm-6">
          <Medida variable="hr" zona={zona} config={config} serie={serie} />
        </div>
      </div>

      <footer className="zona-pie">
        {zona.controlada && (
          <div className="d-flex justify-content-between flex-wrap gap-1">
            <span>
              Fuera de rango hoy:{" "}
              <strong style={{ color: zona.hoy.minutos.fuera > 0 ? COLOR_ESTADO.fuera : COLOR_ESTADO.ok }}>
                {formatoDuracion(zona.hoy.minutos.fuera)}
              </strong>
            </span>
            <span>
              Tiempo en rango hoy: <strong>{pct === null ? "—" : `${formatoNumero(pct, 0)} %`}</strong>
            </span>
          </div>
        )}
        <div className="d-flex justify-content-between flex-wrap gap-1">
          <span title="Déficit de presión de vapor: cuánto 'seca' el aire a las plantas">
            VPD: <strong style={{ color: colorVpd }}>{conUnidad(zona.vpd.valor, "kPa", 2)}</strong>
            {["ok", "cerca", "bajo", "alto"].includes(zona.vpd.estado) && (
              <span className="ms-1" style={{ color: colorVpd }}>
                ({zona.vpd.estado === "bajo" ? "baja transpiración" : zona.vpd.estado === "alto" ? "estrés hídrico" : "óptimo"})
              </span>
            )}
          </span>
          <span className="text-body-secondary">
            {vpd.min === null && vpd.max === null ? "VPD sin rango definido" : `Óptimo ${textoRango(vpd.min, vpd.max, "kPa", 1)}`}
          </span>
        </div>
        {zona.equipo && (
          <div className="text-body-secondary">
            <i className="bi bi-cpu me-1" aria-hidden="true" />
            Equipo de la cámara:{" "}
            {Date.now() - Date.parse(zona.equipo.time) > 3600_000 ? (
              <span>sin datos desde el {fechaHoraChile(zona.equipo.time).slice(0, 10)}</span>
            ) : (
              <strong style={{ color: zona.equipo.valor === 1 ? COLOR_ESTADO.ok : COLOR_NEUTRO }}>
                {zona.equipo.valor === 1 ? "activo" : "inactivo"}
              </strong>
            )}
          </div>
        )}
      </footer>
    </section>
  );
}

export default ZonaCard;
