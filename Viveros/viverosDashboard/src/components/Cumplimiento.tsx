import { useState } from "react";
import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { COLOR_ZONA, ZONAS_CONTROLADAS } from "../config";
import { getEpisodios, getResumen } from "../lib/api";
import { COLOR_GRILLA } from "../lib/charts";
import { COLOR_ESTADO, porcentajeEnRango, tonoCumplimiento } from "../lib/estados";
import { etiquetaDia, hoyChile, sumarDias } from "../lib/fechas";
import { formatoDuracion, formatoNumero } from "../lib/formato";
import { usePolling } from "../hooks/usePolling";
import type { Episodio, MinutosEstado, ResumenZona, ZonaConfig } from "../lib/tipos";
import Episodios from "./Episodios";
import MapaCalor from "./MapaCalor";

const PERIODOS = [7, 30] as const;
const REFRESCO_MS = 10 * 60_000;

const CATEGORIAS: { clave: keyof MinutosEstado; texto: string; color: string }[] = [
  { clave: "ok", texto: "En rango", color: COLOR_ESTADO.ok },
  { clave: "cerca", texto: "Cerca del límite", color: "#e0b100" },
  { clave: "fuera", texto: "Fuera de rango", color: COLOR_ESTADO.fuera },
  { clave: "sin_datos", texto: "Sin datos", color: "#ced4da" },
];

const sumar = (lista: MinutosEstado[]): MinutosEstado =>
  lista.reduce(
    (a, m) => ({ ok: a.ok + m.ok, cerca: a.cerca + m.cerca, fuera: a.fuera + m.fuera, sin_datos: a.sin_datos + m.sin_datos }),
    { ok: 0, cerca: 0, fuera: 0, sin_datos: 0 },
  );

function GraficoDiario({ zona }: { zona: ResumenZona }) {
  const opciones: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (item) => {
            const m = zona.dias[item.dataIndex].minutos[CATEGORIAS[item.datasetIndex].clave];
            return `${item.dataset.label}: ${formatoDuracion(m)} (${formatoNumero(item.parsed.y, 0)} %)`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        max: 100,
        grid: { color: COLOR_GRILLA },
        border: { display: false },
        ticks: { callback: (v) => `${v} %` },
      },
    },
  };
  const totalDia = (m: MinutosEstado) => m.ok + m.cerca + m.fuera + m.sin_datos || 1;
  return (
    <div style={{ height: 210 }}>
      <Bar
        options={opciones}
        data={{
          labels: zona.dias.map((d) => etiquetaDia(d.dia)),
          datasets: CATEGORIAS.map((c) => ({
            label: c.texto,
            data: zona.dias.map((d) => (d.minutos[c.clave] / totalDia(d.minutos)) * 100),
            backgroundColor: c.color,
            borderWidth: 0,
            barPercentage: 0.85,
          })),
        }}
      />
    </div>
  );
}

function Indicador({ zona }: { zona: ResumenZona }) {
  const total = sumar(zona.dias.map((d) => d.minutos));
  const pct = porcentajeEnRango(total);
  const tono = tonoCumplimiento(total);
  const conDatos = zona.dias.filter((d) => porcentajeEnRango(d.minutos) !== null);
  const peor = conDatos.reduce<(typeof conDatos)[number] | null>(
    (p, d) => (!p || porcentajeEnRango(d.minutos)! < porcentajeEnRango(p.minutos)! ? d : p),
    null,
  );
  return (
    <div className="indicador" style={{ borderLeftColor: COLOR_ZONA[zona.id] }}>
      <div className="small text-body-secondary fw-semibold">{zona.nombre}</div>
      <div className="valor-grande" style={{ color: COLOR_ESTADO[tono] }}>
        {pct === null ? "Sin datos" : `${formatoNumero(pct, 1)} %`}
      </div>
      <div className="small text-body-secondary">del tiempo en rango</div>
      <div className="small mt-1">
        Fuera de rango: <strong>{formatoDuracion(total.fuera)}</strong>
        {total.sin_datos >= 60 && (
          <>
            {" "}
            · Sin datos: <strong>{formatoDuracion(total.sin_datos)}</strong>
          </>
        )}
      </div>
      {peor && (
        <div className="small text-body-secondary">
          Peor día: {etiquetaDia(peor.dia)} ({formatoNumero(porcentajeEnRango(peor.minutos)!, 0)} %)
        </div>
      )}
    </div>
  );
}

/** ¿Cuánto tiempo estuvo cada cámara dentro de rango? Por día, por hora y por episodio. */
function Cumplimiento({ config }: { config: ZonaConfig[] }) {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(7);
  const [resumen, setResumen] = useState<ResumenZona[] | null>(null);
  const [episodios, setEpisodios] = useState<Episodio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyChile();
  const start = sumarDias(hoy, -(dias - 1));
  const versionConfig = JSON.stringify(config.map((c) => c.variables));

  usePolling(
    () => {
      setError(null);
      Promise.all([getResumen(start, hoy), getEpisodios(start, hoy)])
        .then(([r, e]) => {
          setResumen(r.filter((z) => ZONAS_CONTROLADAS.includes(z.id)));
          setEpisodios(e);
        })
        .catch((e: Error) => setError(e.message));
    },
    REFRESCO_MS,
    `${start}|${versionConfig}`,
  );

  return (
    <section className="tarjeta" aria-labelledby="titulo-cumplimiento">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 id="titulo-cumplimiento" className="h5 mb-0">
            Cumplimiento
          </h2>
          <div className="small text-body-secondary">
            Porcentaje del tiempo con datos en que temperatura y humedad estuvieron dentro del rango permitido.
          </div>
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn ${dias === p ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setDias(p)}
            >
              {p} días
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!resumen ? (
        !error && (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-secondary" role="status">
              <span className="visually-hidden">Cargando…</span>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="row g-3 mb-2">
            {resumen.map((z) => (
              <div className="col-12 col-lg-6" key={z.id}>
                <Indicador zona={z} />
                <GraficoDiario zona={z} />
              </div>
            ))}
          </div>
          <MapaCalor config={config} />
          {episodios && <Episodios episodios={episodios} />}
        </>
      )}
    </section>
  );
}

export default Cumplimiento;
