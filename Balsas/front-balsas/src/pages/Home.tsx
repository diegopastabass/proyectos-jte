import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import GraphCard from "../components/GraphCard";
import MultiLineGraphCard from "../components/MultiLineGraphCard";
import ScadaDiagram from "../components/ScadaDiagram";
import ElectricPanel from "../components/ElectricPanel";
import ExportModal from "../components/ExportModal";
import { fetchApi, fetchWithCache } from "../components/fetchWithcache";
import Loading from "./Loading";
import ErrorPage from "./Error";
import lgoJte from "../assets/logoJte.png";
import "../index.css";
import "../balsas.css";
import {
  POZOS,
  apiUrl,
  estadoComunicacion,
  formatDuracion,
  minutosDesde,
  todayInChile,
  type Datos,
  type EstadoComunicacion,
  type Metric,
  type MultiSeries,
  type PozoId,
} from "../balsas";

// Las series se piden por clave: cada recurso falla por separado y el resto se actualiza
type Series = Record<string, Metric[]>;
type SeriesMulti = Record<string, MultiSeries>;

const REFRESCO_MS = 60000;

const TEXTO_COMUNICACION: Record<EstadoComunicacion, string> = {
  ok: "En línea",
  retrasado: "Retrasado",
  sin_datos: "Sin datos",
};

const TEXTO_TENDENCIA = {
  vaciado: "Vaciando",
  llenado: "Llenando",
  estable: "Estable",
  sin_datos: "Sin tendencia",
};

interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  detalle?: string;
  alarma?: boolean;
  /** Barra de llenado, de 0 a 100. */
  progreso?: number;
}

function Kpi({ label, value, unit, detalle, alarma, progreso }: KpiProps) {
  return (
    <div className={`card balsas-card kpi${alarma ? " kpi--alarma" : ""}`}>
      <span className="balsas-label">{label}</span>
      <strong className="kpi__valor">
        {value}
        {unit && <small> {unit}</small>}
      </strong>
      {progreso !== undefined && (
        <div className="kpi__barra">
          <div style={{ transform: `scaleX(${Math.min(1, Math.max(0, progreso / 100))})` }} />
        </div>
      )}
      {detalle && <span className="kpi__detalle">{detalle}</span>}
    </div>
  );
}

function Home() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [series, setSeries] = useState<Series>({});
  const [multi, setMulti] = useState<SeriesMulti>({});
  const [isOpenExport, setIsOpenExport] = useState(false);

  useEffect(() => {
    const combinar = <T,>(
      prev: Record<string, T>,
      claves: string[],
      resultados: PromiseSettledResult<T>[],
    ) => {
      const siguiente = { ...prev };
      resultados.forEach((r, i) => {
        if (r.status === "fulfilled") siguiente[claves[i]] = r.value;
        else console.error(`Error al cargar ${claves[i]}:`, r.reason);
      });
      return siguiente;
    };

    const fetchData = async () => {
      // Se calcula en cada ciclo: la pantalla puede quedar abierta pasada la medianoche
      const hoy = todayInChile();
      const dia = { start: hoy, end: hoy };

      const pedidosSeries: Record<string, Promise<Metric[]>> = {
        nivel: fetchApi("nivel", dia),
        caudal: fetchApi("caudal", dia),
        presion: fetchApi("presion", dia),
        caudal_descarga: fetchApi("caudal_descarga", dia),
        totalizador: fetchWithCache("totalizador", {}, hoy),
        totalizador_descarga: fetchWithCache("totalizador_descarga", {}, hoy),
        ...Object.fromEntries(
          POZOS.map((p) => [`horometro_${p.id}`, fetchWithCache("horometro", { pozo: p.id }, hoy)]),
        ),
      };
      const pedidosMulti: Record<string, Promise<MultiSeries>> = Object.fromEntries(
        POZOS.flatMap((p) => [
          [`voltaje_${p.id}`, fetchApi("voltaje", { pozo: p.id, ...dia })],
          [`corriente_${p.id}`, fetchApi("corriente", { pozo: p.id, ...dia })],
        ]),
      );

      const [snapshot, resultadosSeries, resultadosMulti] = await Promise.all([
        fetchApi<Datos>("snapshot").then(
          (valor) => ({ valor }),
          (error: unknown) => ({ error }),
        ),
        Promise.allSettled(Object.values(pedidosSeries)),
        Promise.allSettled(Object.values(pedidosMulti)),
      ]);

      if ("valor" in snapshot) setData(snapshot.valor);
      else console.error("Error al cargar snapshot:", snapshot.error);
      setSeries((prev) => combinar(prev, Object.keys(pedidosSeries), resultadosSeries));
      setMulti((prev) => combinar(prev, Object.keys(pedidosMulti), resultadosMulti));
      setAhora(Date.now());
      setLoading(false);
    };

    fetchData();
    const intervalId = setInterval(fetchData, REFRESCO_MS);
    return () => clearInterval(intervalId);
  }, []);

  if (loading) return <Loading />;
  if (!data) return <ErrorPage />;

  const { snapshot, equipos, tiempo_vaciado, nivel_alerta, nivel_maximo } = data;

  const ultimaLectura = equipos.reduce<string>(
    (ultima, e) => (e.time && e.time > ultima ? e.time : ultima),
    "",
  );

  const nivel = snapshot.estanque?.value ?? 0;
  const nivelBajo = !!snapshot.estanque && nivel < nivel_alerta;

  const horometro: Partial<Record<PozoId, Metric[]>> = {
    pozo_1: series.horometro_pozo_1,
    pozo_2: series.horometro_pozo_2,
  };

  const comunicacion = equipos.map((e) => ({
    ...e,
    estado: estadoComunicacion(e.time, ahora),
    minutos: minutosDesde(e.time, ahora),
  }));
  const sinDatos = comunicacion.filter((e) => e.estado === "sin_datos");

  return (
    <div className="balsas-page">
      <Navbar text={ultimaLectura}>
        <button
          className="btn btn-outline-primary bi bi-save"
          aria-label="Exportar datos"
          onClick={() => setIsOpenExport(true)}
        ></button>
      </Navbar>

      <main className="balsas-main">
        {(nivelBajo || sinDatos.length > 0) && (
          <section className="balsas-alertas" role="alert">
            {nivelBajo && (
              <div className="balsas-alerta">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                <span>
                  <strong>Nivel crítico en el estanque:</strong> {nivel.toFixed(2)} m,
                  bajo el umbral de {nivel_alerta.toFixed(1)} m.
                </span>
              </div>
            )}
            {sinDatos.map((e) => (
              <div className="balsas-alerta" key={e.id}>
                <i className="bi bi-wifi-off" aria-hidden="true" />
                <span>
                  <strong>{e.nombre} sin datos</strong>
                  {e.minutos === null
                    ? ": no hay registros."
                    : ` hace ${formatDuracion(e.minutos)}. Los valores mostrados pueden estar desactualizados.`}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="balsas-kpis" aria-label="Indicadores principales">
          <Kpi
            label="Nivel estanque"
            value={nivel.toFixed(2)}
            unit="m"
            progreso={(nivel / nivel_maximo) * 100}
            detalle={`${Math.round((nivel / nivel_maximo) * 100)} % · ${TEXTO_TENDENCIA[tiempo_vaciado.tendencia]}`}
            alarma={nivelBajo}
          />
          <Kpi
            label="Tiempo de vaciado"
            value={tiempo_vaciado.formatted.replace(/ \d+ s$/, "")}
            detalle="Según los últimos 20 min"
          />
          <Kpi
            label="Caudal impulsión"
            value={(snapshot.caudal?.value ?? 0).toFixed(1)}
            unit="l/s"
            detalle="FIT-01 · Pozo 2"
          />
          <Kpi
            label="Presión impulsión"
            value={(snapshot.presion?.value ?? 0).toFixed(1)}
            unit="bar"
            detalle="PI-01 · Pozo 2"
          />
          <Kpi
            label="Caudal descarga"
            value={(snapshot.caudal_descarga?.value ?? 0).toFixed(1)}
            unit="l/s"
            detalle="FIT-02 · A la red"
          />
          <Kpi
            label="Panel solar"
            value={(snapshot.solar?.value ?? 0).toFixed(2)}
            unit="V"
            detalle="Equipo del estanque"
          />
        </section>

        <section className="balsas-proceso">
          <div className="card balsas-card balsas-scada d-none d-lg-block">
            <ScadaDiagram
              data={data}
              horometro={horometro}
              totalizador={series.totalizador ?? []}
              totalizadorDescarga={series.totalizador_descarga ?? []}
            />
          </div>

          <aside className="card balsas-card comunicacion" aria-label="Comunicación de equipos">
            <h2 className="balsas-card__title">Comunicación</h2>
            <ul className="comunicacion__lista">
              {comunicacion.map((e) => (
                <li key={e.id}>
                  <span className={`comunicacion__punto comunicacion__punto--${e.estado}`} aria-hidden="true" />
                  <div className="comunicacion__equipo">
                    <strong>{e.nombre}</strong>
                    <code>{e.equipo}</code>
                  </div>
                  <div className="comunicacion__estado">
                    <span>{TEXTO_COMUNICACION[e.estado]}</span>
                    <small>{e.minutos === null ? "—" : `hace ${formatDuracion(Math.max(0, e.minutos))}`}</small>
                  </div>
                </li>
              ))}
            </ul>
            <p className="comunicacion__nota">
              Se avisa por WhatsApp si un equipo pasa más de 30 min sin datos o si el
              nivel baja de {nivel_alerta.toFixed(1)} m.
            </p>
          </aside>
        </section>

        <h2 className="balsas-seccion">Sistema eléctrico</h2>
        <section className="balsas-grid-2">
          {POZOS.map((p) => (
            <ElectricPanel key={p.id} pozo={p.id} nombre={p.nombre} snapshot={snapshot} />
          ))}
          {POZOS.map((p) => (
            <MultiLineGraphCard
              key={`voltaje-${p.id}`}
              isOpen
              title={`Voltaje ${p.nombre}`}
              chartLabel="Voltaje de línea (V)"
              initialData={multi[`voltaje_${p.id}`] ?? {}}
              fetchEndpoint={apiUrl("voltaje", { pozo: p.id })}
              desdeCero={false}
            />
          ))}
          {POZOS.map((p) => (
            <MultiLineGraphCard
              key={`corriente-${p.id}`}
              isOpen
              title={`Corriente ${p.nombre}`}
              chartLabel="Corriente (A)"
              initialData={multi[`corriente_${p.id}`] ?? {}}
              fetchEndpoint={apiUrl("corriente", { pozo: p.id })}
            />
          ))}
        </section>

        <h2 className="balsas-seccion">Tendencias</h2>
        <section className="balsas-grid-2">
          <GraphCard
            isOpen
            title="Nivel Estanque"
            chartLabel="Nivel del Estanque (m)"
            initialData={series.nivel ?? []}
            type="nivel"
            fetchEndpoint={apiUrl("nivel")}
            nivelMax={nivel_maximo}
            nivelAlarma={nivel_alerta}
          />
          <GraphCard
            isOpen
            title="Caudal Impulsión"
            chartLabel="Caudal (l/s)"
            initialData={series.caudal ?? []}
            type="caudal"
            fetchEndpoint={apiUrl("caudal")}
          />
          <GraphCard
            isOpen
            title="Presión Impulsión"
            chartLabel="Presión (bar)"
            initialData={series.presion ?? []}
            type="caudal"
            fetchEndpoint={apiUrl("presion")}
          />
          <GraphCard
            isOpen
            title="Caudal Descarga"
            chartLabel="Caudal (l/s)"
            initialData={series.caudal_descarga ?? []}
            type="caudal"
            fetchEndpoint={apiUrl("caudal_descarga")}
          />
          <GraphCard
            isOpen
            title="Totalizador Impulsión Diario"
            chartLabel="Totalizador (m³)"
            initialData={series.totalizador ?? []}
            type="totalizador"
          />
          <GraphCard
            isOpen
            title="Totalizador Descarga Diario"
            chartLabel="Totalizador (m³)"
            initialData={series.totalizador_descarga ?? []}
            type="totalizador"
          />
          {POZOS.map((p) => (
            <GraphCard
              key={`horometro-${p.id}`}
              isOpen
              title={`Horómetro ${p.nombre}`}
              chartLabel="Horas de operación"
              initialData={series[`horometro_${p.id}`] ?? []}
              type="horometro"
            />
          ))}
        </section>
      </main>

      <footer className="balsas-footer">
        <p className="text-body-secondary mb-0">&copy; {new Date().getFullYear()} JTE Analytics.</p>
        <img src={lgoJte} alt="JTE Analytics" width={40} height={24} />
      </footer>

      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </div>
  );
}

export default Home;
