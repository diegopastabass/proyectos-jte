import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import State, { StateBody } from "../components/States";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import GraphCard from "../components/GraphCard";
import Error from "./Error";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import lgoJte from "../assets/logoJte.png";
import { fetchWithCache } from "../components/fetchWithcache";
import DataArrivalIndicator from "../components/DataArrivalIndicator";

interface Metric {
  value: number;
  time: string;
}

interface MetricSnapshot {
  [key: string]: Metric;
}

interface Datos {
  pozo1: MetricSnapshot;
  pozo2: MetricSnapshot;
  estanque: MetricSnapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

const BASE_URL = "https://app.jteanalytics.cl/cumpeo";

/** Returns the most recent timestamp from all metrics in a snapshot */
function getLatestTime(snapshot: MetricSnapshot | undefined): string | undefined {
  if (!snapshot) return undefined;
  const times = Object.values(snapshot)
    .map((m) => new Date(m.time).getTime())
    .filter((t) => !isNaN(t));
  if (times.length === 0) return undefined;
  return new Date(Math.max(...times)).toISOString();
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);

  const [nivelEstanque, setNivelEstanque] = useState<Metric[]>([]);
  const [caudalPozo1, setCaudalPozo1] = useState<Metric[]>([]);
  const [caudalPozo2, setCaudalPozo2] = useState<Metric[]>([]);
  const [horometro, setHorometro] = useState<Metric[]>([]);
  const [horometroPozo2, setHorometroPozo2] = useState<Metric[]>([]);
  const [totalizador, setTotalizador] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenBomba, setIsOpenBomba] = useState(isLargeScreen);
  const [isOpenPozo2, setIsOpenPozo2] = useState(isLargeScreen);
  const [isOpenExport, setIsOpenExport] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 992);
    window.addEventListener("resize", handleResize);

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const now = new Date();
    const date = formatter.format(now);

    const fetchData = async () => {
      try {
        const [snapshotRes, nivelRes, caudalPozo1Res, caudalPozo2Res] =
          await Promise.all([
            fetch(`${BASE_URL}/snapshot`),
            fetch(`${BASE_URL}/nivel?start=${date}&end=${date}`),
            fetch(`${BASE_URL}/caudal-pozo1?start=${date}&end=${date}`),
            fetch(`${BASE_URL}/caudal-pozo2?start=${date}&end=${date}`),
          ]);

        const snapshotData: Datos = await snapshotRes.json();

        setData(snapshotData);
        setNivelEstanque(await nivelRes.json());
        setCaudalPozo1(await caudalPozo1Res.json());
        setCaudalPozo2(await caudalPozo2Res.json());
        setTotalizador(await fetchWithCache("totalizador", date));
        setHorometro(await fetchWithCache("horometro", date));
        setHorometroPozo2(await fetchWithCache("horometro-pozo2", date));
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

  // Obtener la fecha más reciente de todos los grupos para el indicador
  const allMetrics = [
    ...Object.values(data.pozo1 || {}),
    ...Object.values(data.pozo2 || {}),
    ...Object.values(data.estanque || {}),
  ];
  const cleanDate =
    allMetrics.length > 0
      ? new Date(
          Math.max(...allMetrics.map((m) => new Date(m.time).getTime())),
        ).toISOString()
      : "";

  const latestHorometro =
    horometro.length > 0 ? horometro[horometro.length - 1].value : 0;
  const horHoras = Math.floor(latestHorometro / 60);
  const horMinutos = Math.floor(latestHorometro % 60);

  const latestHorometroP2 =
    horometroPozo2.length > 0
      ? horometroPozo2[horometroPozo2.length - 1].value
      : 0;
  const horHorasP2 = Math.floor(latestHorometroP2 / 60);
  const horMinutosP2 = Math.floor(latestHorometroP2 % 60);

  const latestTotalizador =
    totalizador.length > 0 ? totalizador[totalizador.length - 1].value : 0;

  /** --- VISTA DESKTOP --- **/
  const DesktopView = () => (
    <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
      <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
        <Navbar text={cleanDate}>
          <button
            className="btn btn-outline-primary bi bi-save"
            onClick={() => setIsOpenExport(true)}
          ></button>
        </Navbar>
      </div>

      <div
        className="row w-100 justify-content-center"
        style={{ maxWidth: "2200px" }}
      >
        <div className="col-12 col-lg-8 d-flex flex-column order-2 order-lg-1">
          <div className="card w-100 p-4">
            <ScadaDiagram
              data={data}
              horometro={horometro}
              totalizador={totalizador}
            />
          </div>
        </div>

        <div className="col-12 col-lg-4 order-1 order-lg-2 mb-1 d-flex flex-column gap-2">
          <GraphCard
            isOpen={true}
            title="Estanque 200m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque}
            type="nivel"
            fetchEndpoint={`${BASE_URL}/nivel`}
            nivelMax={5}
            nivelAlarma={2.5}
          />
          <GraphCard
            isOpen
            title="Caudal"
            chartLabel="San Enrique 3 (l/s)"
            initialData={caudalPozo1}
            type="caudal"
            fetchEndpoint={`${BASE_URL}/caudal-pozo1`}
            divisor={1}
            nivelMax={20}
            secondaryInitialData={caudalPozo2}
            secondaryFetchEndpoint={`${BASE_URL}/caudal-pozo2`}
            secondaryLabel="San Enrique 1 (l/s)"
            secondaryDivisor={100}
          />
        </div>

        {/* Gráficos diarios - Totalizador SE6, Horómetro SE6, Horómetro SE3 */}
        <div className="w-100 row g-2 p-0 order-3 justify-content-center">
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Totalizador - San Enrique 3"
              chartLabel="Totalizador (m³)"
              initialData={totalizador}
              type="totalizador"
              divisor={10}
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Horómetro - San Enrique 3"
              chartLabel="Horómetro"
              initialData={horometro}
              type="horometro"
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Horómetro - San Enrique 1"
              chartLabel="Horómetro"
              initialData={horometroPozo2}
              type="horometro"
            />
          </div>
        </div>
      </div>

      <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
        <p className="text-body-secondary">&copy; 2026 JTE Analytics.</p>
        <img src={lgoJte} alt="logo" width={40} height={24} />
      </footer>
    </div>
  );

  /** --- VISTA MÓVIL --- **/
  const MobileView = () => (
    <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
      <div className="mb-3 w-100">
        <Navbar text={cleanDate}>
          <button
            className="btn btn-outline-primary bi bi-save"
            onClick={() => setIsOpenExport(true)}
          ></button>
        </Navbar>
      </div>

      <div className="w-100 px-2">
        {/* Indicadores de llegada de datos */}
        <div className="mb-2 d-flex flex-column gap-2">
          <DataArrivalIndicator
            label="San Enrique 3"
            latestTime={getLatestTime(data.pozo1)}
          />
          <DataArrivalIndicator
            label="San Enrique 1"
            latestTime={getLatestTime(data.pozo2)}
          />
        </div>

        {/* Estanque */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Estanque 200m³"
              text1={[
                "Nivel",
                `${data.estanque?.estanque?.value?.toFixed(2) ?? "—"} m`,
              ]}
              text2={["Tiempo Vaciado", `${data.tiempo_vaciado_formatted}`]}
            />
            <TankLevelCircular
              nivelActual={data.estanque?.estanque?.value ?? 0}
              nivelMaximo={4.5}
            />
            <ToggleCardButton
              isOpen={isOpenEstanque}
              onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenEstanque}
            title="Estanque 200m³"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque}
            type="nivel"
            fetchEndpoint={`${BASE_URL}/nivel`}
            nivelMax={5}
            nivelAlarma={2.5}
          />
        </div>

        {/* San Enrique 3 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="San Enrique 3"
              text1={[
                "Presión",
                `${(data.pozo1?.presion?.value / 10).toFixed(1) ?? "—"} bar`,
              ]}
              text2={[
                "Horómetro Hoy",
                `${horHoras}:${String(horMinutos).padStart(2, "0")} h`,
              ]}
              text3={[
                "Totalizador Diario",
                `${(latestTotalizador / 10).toFixed(2)} m³`,
              ]}
              text4={[
                "Totalizador Total",
                `${data.pozo1?.totalizador?.value ? (data.pozo1.totalizador.value / 10).toFixed(2) : "—"} m³`,
              ]}
            />
            <ToggleCardButton
              isOpen={isOpenBomba}
              onToggle={() => setIsOpenBomba(!isOpenBomba)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenBomba}
            title="Horómetro - San Enrique 3"
            chartLabel="Horómetro"
            initialData={horometro}
            type="horometro"
          />
          <GraphCard
            isOpen={isOpenBomba}
            title="Totalizador - San Enrique 3"
            chartLabel="Totalizador (m³)"
            initialData={totalizador}
            type="totalizador"
            divisor={10}
          />
        </div>

        {/* San Enrique 1 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="San Enrique 1"
              text1={[
                "Caudal",
                `${(data.pozo2?.caudal_pozos?.value / 100).toFixed(2) ?? "—"} l/s`,
              ]}
              text2={[
                "Horómetro Hoy",
                `${horHorasP2}:${String(horMinutosP2).padStart(2, "0")} h`,
              ]}
            />
            <ToggleCardButton
              isOpen={isOpenPozo2}
              onToggle={() => setIsOpenPozo2(!isOpenPozo2)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenPozo2}
            title="Caudal"
            chartLabel="San Enrique 3 (l/s)"
            initialData={caudalPozo1}
            type="caudal"
            fetchEndpoint={`${BASE_URL}/caudal-pozo1`}
            divisor={1}
            nivelMax={20}
            secondaryInitialData={caudalPozo2}
            secondaryFetchEndpoint={`${BASE_URL}/caudal-pozo2`}
            secondaryLabel="San Enrique 1 (l/s)"
            secondaryDivisor={100}
          />
          <GraphCard
            isOpen={isOpenPozo2}
            title="Horómetro - San Enrique 1"
            chartLabel="Horómetro"
            initialData={horometroPozo2}
            type="horometro"
          />
        </div>

        {/* Estado */}
        <div className="mb-2">
          <State title="Estado Tablero - San Enrique 3">
            <StateBody
              automatico={data.pozo1?.automatico?.value?.toString() ?? "0"}
              bomba={data.pozo1?.bomba?.value?.toString() ?? "0"}
              falla={data.pozo1?.falla?.value?.toString() ?? "0"}
              falla_asimetria={data.pozo1?.asimetria.value?.toString()}
              presion={data.pozo1?.presion?.value ?? 0}
              horometro_diario={latestHorometro}
              horometro_total={data.pozo1?.horometro?.value ?? 0}
              caudal={data.pozo1?.caudal?.value ?? 0}
            />
          </State>
        </div>
        {/* Estado Pozo 3 */}
        <div className="mb-2">
          <State title="Estado Tablero - San Enrique 1">
            <StateBody caudal={(data.pozo2?.caudal_pozos?.value ?? 0) / 100} />
          </State>
        </div>
      </div>

      <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
        <p className="text-body-secondary">&copy; 2026 JTE Analytics.</p>
        <img src={lgoJte} alt="logo" width={40} height={24} />
      </footer>
    </div>
  );

  return (
    <>
      {isLargeScreen ? <DesktopView /> : <MobileView />}
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default App;
