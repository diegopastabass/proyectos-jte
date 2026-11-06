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
import { API_BASE, fetchApi, fetchWithCache } from "../components/fetchWithcache";
import MultiLineGraphCard from "../components/MultiLineGraphCard";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  falla: Metric; //
  bomba: Metric; //
  asimetria: Metric; //
  automatico: Metric; //
  estanque: Metric; //
  caudal: Metric; //
  horometro: Metric; //
  totalizador: Metric; //

  freatico: Metric;
  // Estanque 20 m³ (ESTANQUE_20M3--slave.AI12 / AI32); pueden faltar si el equipo no reporta
  nivel_2?: Metric;
  voltaje_2?: Metric;
  L1: Metric;
  L2: Metric;
  L3: Metric;
  I1: Metric;
  I2: Metric;
  I3: Metric;
  kwh: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
  tiempo_vaciado_est_2: number;
  tiempo_vaciado_est_2_formatted: string;
  nivel_alerta: number;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);

  const [nivelEstanque1, setNivelEstanque1] = useState<Metric[]>([]);
  const [nivelEstanque2, setNivelEstanque2] = useState<Metric[]>([]);
  const [caudal, setCaudal] = useState<Metric[]>([]);
  const [horometro, setHorometro] = useState<Metric[]>([]);
  const [totalizador, setTotalizador] = useState<Metric[]>([]);
  const [voltajeChartData, setVoltajeData] = useState<Record<string, Metric[]>>({});
  const [corrienteChartData, setCorrienteData] = useState<Record<string, Metric[]>>({});

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenBomba, setIsOpenBomba] = useState(isLargeScreen);
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

    // Cada recurso se pide por separado: si uno falla, el resto igual se actualiza
    const fetchData = async () => {
      const [snapshot, nivel1, nivel2, caudalRes, totalizadorRes, horometroRes, voltaje, corriente] =
        await Promise.allSettled([
          fetchApi<Datos>("snapshot"),
          fetchApi<Metric[]>("nivel", date),
          fetchApi<Metric[]>("nivel2", date),
          fetchApi<Metric[]>("caudal", date),
          fetchWithCache("totalizador", date),
          fetchWithCache("horometro", date),
          fetchApi<Record<string, Metric[]>>("voltaje", date),
          fetchApi<Record<string, Metric[]>>("corriente", date),
        ]);

      const apply = <T,>(result: PromiseSettledResult<T>, set: (v: T) => void) => {
        if (result.status === "fulfilled") set(result.value);
        else console.error("Error al cargar datos:", result.reason);
      };

      apply(snapshot, setData);
      apply(nivel1, setNivelEstanque1);
      apply(nivel2, setNivelEstanque2);
      apply(caudalRes, setCaudal);
      apply(totalizadorRes, setTotalizador);
      apply(horometroRes, setHorometro);
      apply(voltaje, setVoltajeData);
      apply(corriente, setCorrienteData);
      setLoading(false);
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

  const nivelAlarma = data.nivel_alerta ?? 2;
  // Umbrales del estanque 20 m³ en la unidad cruda del API (cm). Mismos valores que monitor_config.json
  const ALARMA_ESTANQUE_2_CM = 120; // 1.2 m: nivel crítico bajo
  const REBALSE_ESTANQUE_2_CM = 220; // 2.2 m: nivel máximo
  const REBALSE_ESTANQUE_1_M = 4.8; // 4.8 m: nivel máximo

  const cleanDate = data?.snapshot
    ? new Date(
        Math.max(
          ...Object.values(data.snapshot).map((m) =>
            new Date(m.time).getTime(),
          ),
        ),
      ).toISOString()
    : "";
  const latestHorometro =
    horometro.length > 0 ? horometro[horometro.length - 1].value : 0;
  const horHoras = Math.floor(latestHorometro / 60);
  const horMinutos = Math.floor(latestHorometro % 60);

  // nivel_2 llega en cm y voltaje_2 en mV
  const nivel2 = (data.snapshot.nivel_2?.value ?? 0) / 100;
  const voltaje2 = (data.snapshot.voltaje_2?.value ?? 0) / 1000;

  const latestTotalizador =
    totalizador.length > 0 ? totalizador[totalizador.length - 1].value : 0;

  // Las vistas se invocan como funciones (no como <Vista />): definidas dentro de
  // Home, cada refresh crearía un tipo de componente nuevo y desmontaría todo el
  // árbol, perdiendo la fecha elegida en los gráficos y las transiciones.

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
            title="Estanque 75 m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint={`${API_BASE}/nivel`}
            nivelMax={5}
            nivelAlarma={nivelAlarma}
            nivelRebalse={REBALSE_ESTANQUE_1_M}
          />
          <GraphCard
            isOpen={true}
            title="Estanque 20 m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque2}
            type="nivel"
            fetchEndpoint={`${API_BASE}/nivel2`}
            nivelMax={250}
            divisor={100}
            nivelAlarma={ALARMA_ESTANQUE_2_CM}
            nivelRebalse={REBALSE_ESTANQUE_2_CM}
          />
          <GraphCard
            isOpen
            title="Caudal"
            chartLabel="Caudal (l/s)"
            initialData={caudal}
            type="caudal"
            fetchEndpoint={`${API_BASE}/caudal`}
            nivelMax={10}
          />
        </div>

        <div className="w-100 row g-2 p-0 order-3 justify-content-center">
          <div className="col-12 col-lg-6">
            <GraphCard
              isOpen
              title="Horómetro Diario"
              chartLabel="Horómetro"
              initialData={horometro}
              type="horometro"
            />
          </div>
          <div className="col-12 col-lg-6">
            <GraphCard
              isOpen
              title="Totalizador Diario"
              chartLabel="Totalizador (m³)"
              initialData={totalizador}
              type="totalizador"
            />
          </div>
        </div>

        <div className="w-100 row g-2 p-0 order-4 justify-content-center mt-2">
          <div className="col-12 col-lg-6">
            <MultiLineGraphCard
              isOpen={true}
              title="Voltaje"
              chartLabel="Voltaje (V)"
              initialData={voltajeChartData}
              fetchEndpoint={`${API_BASE}/voltaje`}
              divisor={10}
            />
          </div>
          <div className="col-12 col-lg-6">
            <MultiLineGraphCard
              isOpen={true}
              title="Corriente"
              chartLabel="Corriente (A)"
              initialData={corrienteChartData}
              fetchEndpoint={`${API_BASE}/corriente`}
              divisor={100}
            />
          </div>
        </div>
      </div>

      <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
        <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
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
        {/* Estanque 1 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Estanque 75 m³"
              text1={["Nivel", `${data.snapshot.estanque.value.toFixed(2)} m`]}
              text2={[
                "Tiempo Vaciado",
                `${data.tiempo_vaciado_est_1_formatted}`,
              ]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.estanque.value}
              nivelMaximo={4}
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
            title="Estanque 75 m³"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint={`${API_BASE}/nivel`}
            nivelMax={5}
            nivelAlarma={nivelAlarma}
            nivelRebalse={REBALSE_ESTANQUE_1_M}
          />
        </div>

        {/* Estanque 2 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Estanque 20 m³"
              text1={["Nivel", `${nivel2.toFixed(2)} m`]}
              text2={["Tiempo Vaciado", data.tiempo_vaciado_est_2_formatted]}
              text3={["Voltaje Panel Solar", `${voltaje2.toFixed(2)} V`]}
            />
            <TankLevelCircular nivelActual={nivel2} nivelMaximo={2} />
            <ToggleCardButton
              isOpen={isOpenEstanque}
              onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenEstanque}
            title="Estanque 20 m³"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque2}
            type="nivel"
            fetchEndpoint={`${API_BASE}/nivel2`}
            nivelMax={250}
            divisor={100}
            nivelAlarma={ALARMA_ESTANQUE_2_CM}
            nivelRebalse={REBALSE_ESTANQUE_2_CM}
          />
        </div>

        {/* Bomba */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Bomba"
              text1={[
                "Caudal Impulsión",
                `${data.snapshot.caudal.value.toFixed(2)} l/s`,
              ]}
              text2={["Horómetro", `${horHoras}:${horMinutos} h`]}
              text3={["Totalizador Diario", `${latestTotalizador} m³`]}
              text4={[
                "Totalizador Total",
                `${data.snapshot.totalizador.value.toFixed(2)} m³`,
              ]}
              text5={["Freatico", `${data.snapshot.freatico.value / 100} m`]}
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
            title="Caudal"
            chartLabel="Caudal (l/s)"
            initialData={caudal}
            type="caudal"
            fetchEndpoint={`${API_BASE}/caudal`}
            nivelMax={10}
          />
          <GraphCard
            isOpen={isOpenBomba}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            initialData={horometro}
            type="horometro"
          />
          <GraphCard
            isOpen={isOpenBomba}
            title="Totalizador Diario"
            chartLabel="Totalizador (m³)"
            initialData={totalizador}
            type="totalizador"
          />
          <MultiLineGraphCard
            isOpen={isOpenBomba}
            title="Voltaje"
            chartLabel="Voltaje (V)"
            initialData={voltajeChartData}
            fetchEndpoint={`${API_BASE}/voltaje`}
            divisor={10}
          />
          <MultiLineGraphCard
            isOpen={isOpenBomba}
            title="Corriente"
            chartLabel="Corriente (A)"
            initialData={corrienteChartData}
            fetchEndpoint={`${API_BASE}/corriente`}
            divisor={100}
          />
        </div>

        {/* Estado */}
        <div className="mb-2">
          <State>
            <StateBody
              automatico={data.snapshot.automatico.value.toString()}
              bomba={data.snapshot.bomba.value.toString()}
              falla={data.snapshot.falla.value.toString()}
              asimetria={data.snapshot.asimetria.value.toString()}
            />
          </State>
        </div>
        <div className="mb-2">
          <State>
            <StateBody
              title="Tablero Eléctrico"
              corriente1={(data.snapshot.I1.value / 100).toString()}
              corriente2={(data.snapshot.I2.value / 100).toString()}
              corriente3={(data.snapshot.I3.value / 100).toString()}
              voltaje1={(data.snapshot.L1.value / 10).toString()}
              voltaje2={(data.snapshot.L2.value / 10).toString()}
              voltaje3={(data.snapshot.L3.value / 10).toString()}
            />
          </State>
        </div>
      </div>

      <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
        <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
        <img src={lgoJte} alt="logo" width={40} height={24} />
      </footer>
    </div>
  );

  return (
    <>
      {isLargeScreen ? DesktopView() : MobileView()}
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default App;
