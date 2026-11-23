import { Fragment, useState } from "react";
import { DECIMALES, UNIDAD, ZONAS_CONTROLADAS, type ZonaId } from "../config";
import { getHorario } from "../lib/api";
import { COLOR_ESTADO, FONDO_ESTADO, TEXTO_VALOR, clasificar, tonoValor } from "../lib/estados";
import { diaChile, etiquetaDia, hoyChile, listarDias, sumarDias } from "../lib/fechas";
import { formatoNumero } from "../lib/formato";
import { usePolling } from "../hooks/usePolling";
import type { PuntoSerie, ZonaConfig } from "../lib/tipos";

const DIAS = 14;
const HORAS = Array.from({ length: 24 }, (_, h) => h);
const fmtHora = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", hourCycle: "h23" });

/**
 * Promedio por hora (filas = días, columnas = horas) coloreado según el rango:
 * deja ver patrones como "se calienta todas las tardes" o "baja cada madrugada".
 */
function MapaCalor({ config }: { config: ZonaConfig[] }) {
  const [zona, setZona] = useState<ZonaId>("frio");
  const [variable, setVariable] = useState<"t" | "hr">("t");
  const [datos, setDatos] = useState<PuntoSerie[] | null>(null);
  const hoy = hoyChile();
  const start = sumarDias(hoy, -(DIAS - 1));

  usePolling(
    () => {
      getHorario(zona, start, hoy)
        .then(setDatos)
        .catch(() => setDatos([]));
    },
    10 * 60_000,
    `${zona}|${start}`,
  );

  const cfg = config.find((c) => c.id === zona)!;
  const rango = cfg.variables[variable];
  const celdas = new Map<string, number | null>();
  for (const p of datos ?? []) {
    celdas.set(`${diaChile(p.time)}|${Number(fmtHora.format(new Date(p.time)))}`, p[variable]);
  }
  const dias = listarDias(start, hoy).reverse();

  return (
    <div className="mt-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h3 className="h6 mb-0">Promedio por hora · últimos {DIAS} días</h3>
        <div className="d-flex flex-wrap gap-2">
          <select
            className="form-select form-select-sm w-auto"
            value={zona}
            onChange={(e) => setZona(e.target.value as ZonaId)}
            aria-label="Zona"
          >
            {ZONAS_CONTROLADAS.map((z) => (
              <option key={z} value={z}>
                {config.find((c) => c.id === z)?.nombre}
              </option>
            ))}
          </select>
          <div className="btn-group btn-group-sm" role="group" aria-label="Variable">
            {(["t", "hr"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`btn ${variable === v ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setVariable(v)}
              >
                {v === "t" ? "Temperatura" : "Humedad"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mapa-calor-contenedor">
        <div className="mapa-calor" role="table" aria-label="Promedio por hora">
          <div />
          {HORAS.map((h) => (
            <div key={h} className="mapa-hora">
              {h % 3 === 0 ? `${String(h).padStart(2, "0")}h` : ""}
            </div>
          ))}
          {dias.map((d) => (
            <Fragment key={d}>
              <div className="mapa-dia">{etiquetaDia(d)}</div>
              {HORAS.map((h) => {
                const v = celdas.get(`${d}|${h}`) ?? null;
                const estado = clasificar(v, rango.min, rango.max, rango.margen);
                const tono = tonoValor(estado);
                const fondo = v === null ? "transparent" : tono === "neutro" ? "#e9ecef" : FONDO_ESTADO[tono];
                const texto = v === null ? "" : tono === "neutro" ? "#495057" : COLOR_ESTADO[tono];
                return (
                  <div
                    key={h}
                    className="mapa-celda"
                    style={{ background: fondo, color: texto }}
                    title={
                      v === null
                        ? `${etiquetaDia(d)} ${h}:00 · sin datos`
                        : `${etiquetaDia(d)} ${h}:00 · ${formatoNumero(v, DECIMALES[variable])} ${UNIDAD[variable]} · ${TEXTO_VALOR[estado]}`
                    }
                  >
                    {v === null ? "" : formatoNumero(v, 0)}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="d-flex flex-wrap gap-3 small text-body-secondary mt-2">
        {(["ok", "cerca", "fuera"] as const).map((t) => (
          <span key={t} className="d-inline-flex align-items-center gap-1">
            <span className="leyenda-cuadro" style={{ background: FONDO_ESTADO[t], borderColor: COLOR_ESTADO[t] }} />
            {t === "ok" ? "En rango" : t === "cerca" ? "Cerca del límite" : "Fuera de rango"}
          </span>
        ))}
        <span>Celda vacía: sin datos</span>
      </div>
    </div>
  );
}

export default MapaCalor;
