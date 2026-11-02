import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import GraphCard from "../components/GraphCard";
import Error from "./Error";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import lgoJte from "../assets/logoJte.png";
import { fetchWithCache } from "../components/fetchWithcache";
import {
  ESTANQUES,
  POZOS,
  POZOS_CON_DATOS,
  apiUrl,
  bombaEncendida,
  formatMinutes,
  todayInChile,
  type Datos,
  type EstanqueId,
  type Metric,
  type PozoId,
} from "../tambo";

type Series<K extends string> = Partial<Record<K, Metric[]>>;

/** Devuelve el JSON de la respuesta, o `fallback` si la API responde con error. */
const getJson = async <T,>(url: string, fallback: T): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Error ${res.status} en ${url}`);
    return fallback;
  }
  return res.json();
};

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);

  const [niveles, setNiveles] = useState<Series<EstanqueId>>({});
  const [caudales, setCaudales] = useState<Series<PozoId>>({});
  const [horometros, setHorometros] = useState<Series<PozoId>>({});

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);
  // Tarjetas abiertas en la vista móvil, por estanque o pozo
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [isOpenExport, setIsOpenExport] = useState(false);

  const toggle = (id: string) => setAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 992);
    window.addEventListener("resize", handleResize);

    const fetchData = async () => {
      const date = todayInChile();
      const rango = { start: date, end: date };
      try {
        const [snapshotData, nivelesData, caudalesData, horometrosData] = await Promise.all([
          getJson<Datos | null>(apiUrl("snapshot"), null),
          Promise.all(
            ESTANQUES.map((e) => getJson<Metric[]>(apiUrl("nivel", { estanque: e.id, ...rango }), [])),
          ),
          Promise.all(
            POZOS_CON_DATOS.map((p) => getJson<Metric[]>(apiUrl("caudal", { pozo: p.id, ...rango }), [])),
          ),
          Promise.all(POZOS_CON_DATOS.map((p) => fetchWithCache("horometro", { pozo: p.id }, date))),
        ]);

        setData(snapshotData);
        setNiveles(Object.fromEntries(ESTANQUES.map((e, i) => [e.id, nivelesData[i]])));
        setCaudales(Object.fromEntries(POZOS_CON_DATOS.map((p, i) => [p.id, caudalesData[i]])));
        setHorometros(Object.fromEntries(POZOS_CON_DATOS.map((p, i) => [p.id, horometrosData[i]])));
      } catch (error) {
        console.error("Error al cargar datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 120000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (loading) return <Loading />;
  if (!data) return <Error />;

  const tiempos = Object.values(data.snapshot).map((m) => new Date(m.time).getTime());
  const cleanDate = tiempos.length > 0 ? new Date(Math.max(...tiempos)).toISOString() : "";

  const hoy = todayInChile();
  const horometroHoy = (pozo: PozoId) =>
    (horometros[pozo] ?? []).find((m) => m.time.slice(0, 10) === hoy)?.value ?? 0;

  const graficoNivel = (e: (typeof ESTANQUES)[number], isOpen: boolean) => (
    <GraphCard
      isOpen={isOpen}
      title={e.nombre}
      chartLabel={`Nivel (${e.unidad})`}
      initialData={niveles[e.id] ?? []}
      type="nivel"
      fetchEndpoint={apiUrl("nivel", { estanque: e.id })}
      divisor={e.divisor}
      nivelMax={e.maximo * e.divisor}
      nivelAlarma={e.alarma * e.divisor}
    />
  );

  const graficoCaudal = (p: (typeof POZOS)[number], isOpen: boolean) => (
    <GraphCard
      isOpen={isOpen}
      title={`Caudal ${p.nombre}`}
      chartLabel="Caudal (l/s)"
      initialData={caudales[p.id] ?? []}
      type="caudal"
      fetchEndpoint={apiUrl("caudal", { pozo: p.id })}
      divisor={p.divisorCaudal}
      nivelMax={50 * p.divisorCaudal}
    />
  );

  const graficoHorometro = (p: (typeof POZOS)[number], isOpen: boolean) => (
    <GraphCard
      isOpen={isOpen}
      title={`Horómetro Diario ${p.nombre}`}
      chartLabel="Horómetro"
      initialData={horometros[p.id] ?? []}
      type="horometro"
    />
  );

  const footer = (
    <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
      <p className="text-body-secondary">&copy; 2026 JTE Analytics.</p>
      <img src={lgoJte} alt="logo" width={40} height={24} />
    </footer>
  );

  const navbar = (
    <div className="mb-3 w-100">
      <Navbar text={cleanDate}>
        <button
          className="btn btn-outline-primary bi bi-save"
          onClick={() => setIsOpenExport(true)}
        ></button>
      </Navbar>
    </div>
  );

  /** --- VISTA DESKTOP --- **/
  const DesktopView = () => (
    <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
      {navbar}

      <div className="row w-100 g-2 justify-content-center" style={{ maxWidth: "2200px" }}>
        <div className="col-12">
          <div className="card w-100 p-4">
            <ScadaDiagram data={data} horometro={horometros} />
          </div>
        </div>

        {ESTANQUES.map((e) => (
          <div key={e.id} className="col-12 col-lg-4">
            {graficoNivel(e, true)}
          </div>
        ))}

        {POZOS_CON_DATOS.map((p) => (
          <div key={p.id} className="col-12 col-lg-6 col-xxl-3">
            {graficoCaudal(p, true)}
          </div>
        ))}
        {POZOS_CON_DATOS.map((p) => (
          <div key={`h-${p.id}`} className="col-12 col-lg-6 col-xxl-3">
            {graficoHorometro(p, true)}
          </div>
        ))}
      </div>

      {footer}
    </div>
  );

  /** --- VISTA MÓVIL --- **/
  const MobileView = () => (
    <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
      {navbar}

      <div className="w-100 px-2">
        {ESTANQUES.map((e) => {
          const nivel = (data.snapshot[e.id]?.value ?? 0) / e.divisor;
          return (
            <div key={e.id}>
              <div className="mb-2">
                <Card>
                  <CardBody
                    title={e.nombre}
                    text1={["Nivel", `${nivel.toFixed(1)} ${e.unidad}`]}
                    text2={[
                      "Tiempo Vaciado",
                      data.tiempo_vaciado[e.id]?.formatted ?? "Sin datos",
                    ]}
                  />
                  <TankLevelCircular nivelActual={nivel} nivelMaximo={e.maximo} />
                  <ToggleCardButton isOpen={!!abiertas[e.id]} onToggle={() => toggle(e.id)} />
                </Card>
              </div>
              <div className="mb-2">{graficoNivel(e, !!abiertas[e.id])}</div>
            </div>
          );
        })}

        {POZOS.map((p) => {
          const metric = p.conDatos ? data.snapshot[p.id] : undefined;
          if (!metric) {
            return (
              <div key={p.id} className="mb-2">
                <Card>
                  <CardBody title={p.nombre} text1={["Estado", "Sin datos (pendiente)"]} />
                </Card>
              </div>
            );
          }
          return (
            <div key={p.id}>
              <div className="mb-2">
                <Card>
                  <CardBody
                    title={p.nombre}
                    text1={["Bomba", bombaEncendida(data.snapshot, p.id) ? "En marcha" : "Detenida"]}
                    text2={["Caudal", `${(metric.value / p.divisorCaudal).toFixed(1)} l/s`]}
                    text3={["Horómetro hoy", formatMinutes(horometroHoy(p.id))]}
                  />
                  <ToggleCardButton isOpen={!!abiertas[p.id]} onToggle={() => toggle(p.id)} />
                </Card>
              </div>
              <div className="mb-2">
                {graficoCaudal(p, !!abiertas[p.id])}
                {graficoHorometro(p, !!abiertas[p.id])}
              </div>
            </div>
          );
        })}
      </div>

      {footer}
    </div>
  );

  return (
    <>
      {/* Se llaman como funciones (no <DesktopView />) para no remontar todo el
          árbol en cada refresco: así las animaciones de nivel transicionan. */}
      {isLargeScreen ? DesktopView() : MobileView()}
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default App;
