import { useEffect, useRef, useState, type ReactNode } from "react";
import "../lib/charts";
import Navbar from "../components/Navbar";
import MetricCard from "../components/MetricCard";
import CaudalDiaChart from "../components/CaudalDiaChart";
import BarrasAgrupadas from "../components/BarrasAgrupadas";
import DaySelector from "../components/DaySelector";
import ExportModal from "../components/ExportModal";
import Loading from "./Loading";
import ErrorPage from "./Error";
import lgoJte from "../assets/logoJte.png";
import type { Latest, Punto } from "../components/types";
import {
  DIAS_DIARIO,
  LINEAS,
  MESES_RESUMEN,
  MIN_SIN_DATOS,
  ORDEN_LINEAS,
  REFRESCO_MS,
  type LineaId,
} from "../config";
import {
  conRango,
  getDiarioConCache,
  getLatest,
  getSerie,
  limpiarCachesAntiguos,
} from "../lib/api";
import {
  etiquetaDia,
  etiquetaMes,
  fechaHoraChile,
  haceCuanto,
  hoyChile,
  listarDias,
  minutosDelDia,
  minutosDesde,
  nombreDia,
  sumarDias,
  ultimosMeses,
} from "../lib/fechas";
import { formatoNumero } from "../lib/formato";
import { usePolling } from "../hooks/usePolling";

type PorLinea<T> = Record<LineaId, T>;

interface DatosDia {
  dia: string;
  caudal: PorLinea<Punto[]>;
  volumen: PorLinea<Punto[]>;
  errorCaudal: PorLinea<boolean>;
  errorVolumen: boolean;
}

const porLinea = <T,>(fn: (id: LineaId) => T): PorLinea<T> => ({
  general: fn("general"),
  riles: fn("riles"),
});

const HORAS = Array.from({ length: 24 }, (_, h) => h);
const dosDigitos = (n: number) => String(n).padStart(2, "0");

limpiarCachesAntiguos();

function Home() {
  const [hoy, setHoy] = useState(hoyChile);
  // null = seguir el día de hoy (también después de medianoche).
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const dia = diaElegido ?? hoy;

  const [latest, setLatest] = useState<Latest | null>(null);
  const [diario, setDiario] = useState<PorLinea<Punto[]> | null>(null);
  const [mensual, setMensual] = useState<PorLinea<Punto[]> | null>(null);
  const [fallos, setFallos] = useState<string[]>([]);
  const [primeraCarga, setPrimeraCarga] = useState(true);

  const [datosDia, setDatosDia] = useState<DatosDia | null>(null);
  const [cargandoDia, setCargandoDia] = useState(true);

  const [isOpenExport, setIsOpenExport] = useState(false);

  const diaActual = useRef(dia);
  useEffect(() => {
    diaActual.current = dia;
  }, [dia]);

  const cargarGenerales = async () => {
    const [rLatest, rDiario, rMensual] = await Promise.allSettled([
      getLatest(),
      Promise.all(
        ORDEN_LINEAS.map((id) =>
          getDiarioConCache(LINEAS[id].totalizador, DIAS_DIARIO),
        ),
      ),
      Promise.all(
        ORDEN_LINEAS.map((id) =>
          getSerie(
            `totalizador-mes/${LINEAS[id].totalizador}?meses=${MESES_RESUMEN}`,
          ),
        ),
      ),
    ]);

    const nuevosFallos: string[] = [];
    if (rLatest.status === "fulfilled") setLatest(rLatest.value);
    else nuevosFallos.push("estado actual");
    if (rDiario.status === "fulfilled") {
      const [general, riles] = rDiario.value;
      setDiario({ general, riles });
    } else nuevosFallos.push("consumo diario");
    if (rMensual.status === "fulfilled") {
      const [general, riles] = rMensual.value;
      setMensual({ general, riles });
    } else nuevosFallos.push("resumen mensual");

    setFallos(nuevosFallos);
    setHoy(hoyChile());
    setPrimeraCarga(false);
  };

  const cargarDia = async () => {
    const solicitado = dia;
    setCargandoDia(true);
    const caudal = await Promise.allSettled(
      ORDEN_LINEAS.map((id) =>
        getSerie(conRango(`caudal/${LINEAS[id].caudal}`, solicitado, solicitado)),
      ),
    );
    const volumen = await Promise.allSettled(
      ORDEN_LINEAS.map((id) =>
        getSerie(
          conRango(`consumo-hora/${LINEAS[id].caudal}`, solicitado, solicitado),
        ),
      ),
    );
    if (diaActual.current !== solicitado) return;

    const valor = (r: PromiseSettledResult<Punto[]>) =>
      r.status === "fulfilled" ? r.value : [];
    const indice = (id: LineaId) => ORDEN_LINEAS.indexOf(id);
    setDatosDia({
      dia: solicitado,
      caudal: porLinea((id) => valor(caudal[indice(id)])),
      volumen: porLinea((id) => valor(volumen[indice(id)])),
      errorCaudal: porLinea((id) => caudal[indice(id)].status === "rejected"),
      errorVolumen: volumen.some((r) => r.status === "rejected"),
    });
    setCargandoDia(false);
  };

  usePolling(cargarGenerales, REFRESCO_MS);
  // El día de hoy se sigue actualizando; un día pasado se consulta una vez.
  usePolling(cargarDia, dia === hoy ? REFRESCO_MS : null, dia);

  if (primeraCarga) return <Loading />;
  if (!latest && !diario) return <ErrorPage />;

  const tiempos = Object.values(latest ?? {})
    .map((p) => p?.time)
    .filter((t): t is string => !!t);
  const ultimoDato = tiempos.sort().at(-1);

  const sinDatos = ORDEN_LINEAS.map((id) => ({
    linea: LINEAS[id],
    time: latest?.[LINEAS[id].caudal]?.time,
  })).filter((s) => s.time && minutosDesde(s.time) > MIN_SIN_DATOS);

  // --- Consumo por hora del día elegido ---
  const datosDelDia = datosDia?.dia === dia ? datosDia : null;
  const volumenPorHora = porLinea((id) => {
    const horas: (number | null)[] = HORAS.map(() => null);
    datosDelDia?.volumen[id].forEach((p) => {
      const h = Math.floor(minutosDelDia(p.time) / 60);
      horas[h] = (horas[h] ?? 0) + p.value;
    });
    return horas;
  });
  const volumenDia = porLinea((id) =>
    datosDelDia && !datosDelDia.errorVolumen
      ? datosDelDia.volumen[id].reduce((s, p) => s + p.value, 0)
      : undefined,
  );

  // --- Consumo diario de los últimos días ---
  const dias = listarDias(sumarDias(hoy, -(DIAS_DIARIO - 1)), hoy);
  const diarioPorLinea = porLinea((id) => {
    const mapa = new Map((diario?.[id] ?? []).map((d) => [d.time, d.value]));
    return dias.map((d) => mapa.get(d) ?? null);
  });

  // --- Consumo mensual ---
  const meses = ultimosMeses(hoy, MESES_RESUMEN);
  const mensualPorLinea = porLinea((id) => {
    const mapa = new Map((mensual?.[id] ?? []).map((d) => [d.time, d.value]));
    return meses.map((m) => mapa.get(m) ?? null);
  });

  return (
    <>
      <div className="min-vh-100 d-flex flex-column bg-body-tertiary">
        <div className="mb-3">
          <Navbar text={ultimoDato}>
            <button
              className="btn btn-outline-primary"
              onClick={() => setIsOpenExport(true)}
              title="Exportar a Excel"
              aria-label="Exportar a Excel"
            >
              <i className="bi bi-file-earmark-spreadsheet" />
              <span className="d-none d-lg-inline ms-1">Exportar</span>
            </button>
          </Navbar>
        </div>

        <main className="container-fluid px-3 px-md-4 flex-grow-1">
          {sinDatos.map((s) => (
            <div key={s.linea.id} className="alert alert-danger py-2 d-flex align-items-center gap-2" role="alert">
              <i className="bi bi-wifi-off" />
              <span>
                Sin datos de <strong>{s.linea.nombre}</strong> desde el{" "}
                {fechaHoraChile(s.time!)} ({haceCuanto(s.time!)}).
              </span>
            </div>
          ))}
          {fallos.length > 0 && (
            <div className="alert alert-warning py-2" role="alert">
              No se pudo actualizar: {fallos.join(", ")}. Se muestran los
              últimos datos disponibles y se reintentará en unos minutos.
            </div>
          )}

          <section className="row g-3 mb-4" aria-label="Resumen">
            {ORDEN_LINEAS.map((id) => (
              <div key={id} className="col-12 col-md-6">
                <MetricCard
                  linea={LINEAS[id]}
                  caudal={latest?.[LINEAS[id].caudal]}
                  totalizador={latest?.[LINEAS[id].totalizador]}
                  diario={diario?.[id] ?? []}
                  hoy={hoy}
                />
              </div>
            ))}
          </section>

          <section className="mb-4" aria-labelledby="titulo-dia">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div>
                <h2 id="titulo-dia" className="h5 mb-0">
                  Caudal del día
                </h2>
                <small className="text-body-secondary">{nombreDia(dia)}</small>
              </div>
              <DaySelector
                dia={dia}
                hoy={hoy}
                onChange={(d) => setDiaElegido(d === hoy ? null : d)}
              />
            </div>

            <div className="row g-3">
              {ORDEN_LINEAS.map((id) => (
                <div key={id} className="col-12 col-lg-6">
                  <CaudalDiaChart
                    linea={LINEAS[id]}
                    puntos={datosDelDia?.caudal[id] ?? []}
                    volumen={volumenDia[id]}
                    cargando={cargandoDia && !datosDelDia}
                    error={datosDelDia?.errorCaudal[id]}
                  />
                </div>
              ))}
            </div>

            <Panel
              className="mt-3"
              titulo="Consumo por hora"
              subtitulo="Estimado a partir del caudal"
              error={datosDelDia?.errorVolumen}
            >
              <BarrasAgrupadas
                etiquetas={HORAS.map(dosDigitos)}
                tituloTooltip={(h) => `${dosDigitos(h)}:00 – ${dosDigitos(h + 1)}:00`}
                series={ORDEN_LINEAS.map((id) => ({
                  nombre: LINEAS[id].nombre,
                  color: LINEAS[id].color,
                  datos: volumenPorHora[id],
                }))}
                unidad="m³"
                altura={240}
              />
            </Panel>
          </section>

          <section className="row g-3 mb-4" aria-label="Consumo histórico">
            <div className="col-12 col-xl-6">
              <Panel
                titulo={`Consumo diario · últimos ${DIAS_DIARIO} días`}
                subtitulo="Según totalizador. Hoy es parcial."
                error={!diario}
              >
                <BarrasAgrupadas
                  etiquetas={dias.map(etiquetaDia)}
                  tituloTooltip={(i) => nombreDia(dias[i])}
                  series={ORDEN_LINEAS.map((id) => ({
                    nombre: LINEAS[id].nombre,
                    color: LINEAS[id].color,
                    datos: diarioPorLinea[id],
                  }))}
                  unidad="m³"
                  decimales={0}
                />
              </Panel>
            </div>
            <div className="col-12 col-xl-6">
              <Panel
                titulo={`Consumo mensual · últimos ${MESES_RESUMEN} meses`}
                subtitulo="Según totalizador. El mes actual es parcial."
                error={!mensual}
              >
                <BarrasAgrupadas
                  etiquetas={meses.map(etiquetaMes)}
                  series={ORDEN_LINEAS.map((id) => ({
                    nombre: LINEAS[id].nombre,
                    color: LINEAS[id].color,
                    datos: mensualPorLinea[id],
                  }))}
                  unidad="m³"
                  decimales={0}
                />
                <details className="mt-2 small">
                  <summary className="text-body-secondary">Ver tabla</summary>
                  <TablaMensual
                    meses={meses}
                    general={mensualPorLinea.general}
                    riles={mensualPorLinea.riles}
                  />
                </details>
              </Panel>
            </div>
          </section>
        </main>

        <footer className="container-fluid px-4 d-flex flex-wrap justify-content-between align-items-center py-3 border-top">
          <p className="text-body-secondary mb-0">
            &copy; {new Date().getFullYear()} JTE Analytics.
          </p>
          <img src={lgoJte} alt="JTE Analytics" width={40} height={24} />
        </footer>
      </div>
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

function Panel({
  titulo,
  subtitulo,
  error,
  className = "",
  children,
}: {
  titulo: string;
  subtitulo?: string;
  error?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`card h-100 shadow-sm ${className}`}>
      <div className="card-body">
        <h3 className="h6 mb-0">{titulo}</h3>
        {subtitulo && <small className="text-body-secondary">{subtitulo}</small>}
        {error ? (
          <p className="text-body-secondary text-center my-5">
            No se pudieron cargar los datos.
          </p>
        ) : (
          <div className="mt-2">{children}</div>
        )}
      </div>
    </div>
  );
}

function TablaMensual({
  meses,
  general,
  riles,
}: {
  meses: string[];
  general: (number | null)[];
  riles: (number | null)[];
}) {
  const celda = (v: number | null) => (v === null ? "—" : formatoNumero(v, 0));
  return (
    <div className="table-responsive mt-2">
      <table className="table table-sm table-hover align-middle mb-0 text-end">
        <thead>
          <tr>
            <th className="text-start">Mes</th>
            <th>General (m³)</th>
            <th>Riles (m³)</th>
          </tr>
        </thead>
        <tbody>
          {meses
            .map((m, i) => ({ m, i }))
            .reverse()
            .map(({ m, i }) => (
              <tr key={m}>
                <td className="text-start text-capitalize">{etiquetaMes(m)}</td>
                <td>{celda(general[i])}</td>
                <td>{celda(riles[i])}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default Home;
