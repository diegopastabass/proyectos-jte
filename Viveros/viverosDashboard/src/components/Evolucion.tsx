import { useState } from "react";
import { COLOR_ZONA, DECIMALES, ORDEN_ZONAS, REFRESCO_SERIES_MS, TOPE_MIN, UNIDAD, type ZonaId } from "../config";
import { getSerie, getSerieHoras } from "../lib/api";
import { hoyChile, inicioDiaChile, nombreDia, sumarDias } from "../lib/fechas";
import { usePolling } from "../hooks/usePolling";
import type { PuntoSerie, ZonaConfig } from "../lib/tipos";
import DaySelector from "./DaySelector";
import SerieChart from "./SerieChart";

type Periodo = "24h" | "7d" | "dia";

const PERIODOS: { id: Periodo; texto: string }[] = [
  { id: "24h", texto: "Últimas 24 h" },
  { id: "7d", texto: "7 días" },
  { id: "dia", texto: "Un día" },
];

interface EvolucionProps {
  config: ZonaConfig[];
  /** Series de 24 h que ya cargó la página (para no pedirlas dos veces). */
  series24: Partial<Record<ZonaId, PuntoSerie[]>>;
}

/** Inicio y fin (instantes) del período elegido. */
function limites(periodo: Periodo, dia: string): [number, number] {
  const ahora = Date.now();
  if (periodo === "24h") return [ahora - 24 * 3600_000, ahora];
  if (periodo === "7d") return [ahora - 7 * 24 * 3600_000, ahora];
  return [inicioDiaChile(dia), Math.min(inicioDiaChile(sumarDias(dia, 1)), ahora)];
}

/** Gráficos por zona: temperatura, humedad y VPD sincronizados en el mismo eje de tiempo. */
function Evolucion({ config, series24 }: EvolucionProps) {
  const [zona, setZona] = useState<ZonaId>("frio");
  const [periodo, setPeriodo] = useState<Periodo>("24h");
  const hoy = hoyChile();
  const [dia, setDia] = useState(hoy);
  const [serie, setSerie] = useState<PuntoSerie[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clave = `${zona}|${periodo}|${dia}`;
  usePolling(
    () => {
      setError(null);
      const pedido =
        periodo === "24h"
          ? series24[zona]
            ? Promise.resolve(series24[zona]!)
            : getSerieHoras(zona, 24)
          : periodo === "7d"
            ? getSerieHoras(zona, 168)
            : getSerie(zona, dia, dia);
      pedido
        .then((s) => setSerie(s))
        .catch((e: Error) => setError(e.message));
    },
    periodo === "dia" && dia < hoy ? null : REFRESCO_SERIES_MS,
    `${clave}|${periodo === "24h" ? (series24[zona]?.length ?? 0) : ""}`,
  );

  const cfg = config.find((c) => c.id === zona);
  const [desde, hasta] = limites(periodo, dia);
  const puntos = (v: "t" | "hr" | "vpd") => (serie ?? []).map((p) => ({ ms: Date.parse(p.time), v: p[v] }));
  const controlada = cfg?.controlada ?? false;
  const color = COLOR_ZONA[zona];

  return (
    <section className="tarjeta" aria-labelledby="titulo-evolucion">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 id="titulo-evolucion" className="h5 mb-0">
          Evolución
        </h2>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="btn-group btn-group-sm" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn ${periodo === p.id ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setPeriodo(p.id)}
              >
                {p.texto}
              </button>
            ))}
          </div>
          {periodo === "dia" && <DaySelector dia={dia} hoy={hoy} onChange={setDia} />}
        </div>
      </div>

      <ul className="nav nav-pills nav-zonas mb-3" role="tablist">
        {ORDEN_ZONAS.map((z) => {
          const c = config.find((x) => x.id === z);
          return (
            <li className="nav-item" key={z} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={zona === z}
                className={`nav-link ${zona === z ? "active" : ""}`}
                style={zona === z ? { background: COLOR_ZONA[z] } : { color: COLOR_ZONA[z] }}
                onClick={() => {
                  setSerie(null);
                  setZona(z);
                }}
              >
                {c?.nombre ?? z}
              </button>
            </li>
          );
        })}
      </ul>

      {periodo === "dia" && <p className="small text-body-secondary mb-2 text-capitalize">{nombreDia(dia)}</p>}
      {!controlada && (
        <p className="small text-body-secondary mb-2">
          <i className="bi bi-info-circle me-1" aria-hidden="true" />
          Datos estimados por Open-Meteo para la ubicación del vivero; sirven de referencia, no son una medición propia.
        </p>
      )}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!serie && !error ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-secondary" role="status">
            <span className="visually-hidden">Cargando…</span>
          </div>
        </div>
      ) : (
        cfg && (
          <div className="d-flex flex-column gap-3">
            {(["t", "hr"] as const).map((v) => (
              <div key={v}>
                <h3 className="h6 mb-1">
                  {v === "t" ? "Temperatura" : "Humedad relativa"}
                  {controlada && (
                    <span className="fw-normal small text-body-secondary ms-2">
                      franja verde = rango permitido · línea roja = fuera de rango
                    </span>
                  )}
                </h3>
                <SerieChart
                  titulo={v === "t" ? "Temperatura" : "Humedad"}
                  puntos={puntos(v)}
                  desde={desde}
                  hasta={hasta}
                  rangoMin={controlada ? cfg.variables[v].min : null}
                  rangoMax={controlada ? cfg.variables[v].max : null}
                  color={color}
                  unidad={UNIDAD[v]}
                  decimales={DECIMALES[v]}
                  topeMin={TOPE_MIN[zona]}
                />
              </div>
            ))}
            <div>
              <h3 className="h6 mb-1">
                VPD (déficit de presión de vapor)
                <span className="fw-normal small text-body-secondary ms-2">
                  {cfg.variables.vpd.min === null && cfg.variables.vpd.max === null
                    ? "sin rango definido para esta zona"
                    : "azul = baja transpiración · verde = óptimo · rojo = estrés hídrico"}
                </span>
              </h3>
              <SerieChart
                titulo="VPD"
                puntos={puntos("vpd")}
                desde={desde}
                hasta={hasta}
                rangoMin={cfg.variables.vpd.min}
                rangoMax={cfg.variables.vpd.max}
                color={color}
                unidad="kPa"
                decimales={2}
                topeMin={TOPE_MIN[zona]}
                franjasVpd
                altura={170}
              />
            </div>
          </div>
        )
      )}
    </section>
  );
}

export default Evolucion;
