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
import { fetchWithCache, fetchWithCacheMulti } from "../components/fetchWithcache";
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

  estanque_2: Metric;
  freatico: Metric;
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
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);

  const [nivelEstanque1, setNivelEstanque1] = useState<Metric[]>([]);
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

    const fetchData = async () => {
      try {
        const [snapshotRes, nivelEstanque1Res, caudalRes] = await Promise.all([
          fetch("https://app.jteanalytics.cl/cuevas/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/cuevas/nivel?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/cuevas/caudal?start=${date}&end=${date}`,
          ),
        ]);

        const snapshotData: Datos = await snapshotRes.json();

        setData(snapshotData);
        setNivelEstanque1(await nivelEstanque1Res.json());
        setCaudal(await caudalRes.json());
        setTotalizador(await fetchWithCache("totalizador", date));
        setHorometro(await fetchWithCache("horometro", date));
        setVoltajeData(await fetchWithCacheMulti("voltaje", date));
        setCorrienteData(await fetchWithCacheMulti("corriente", date));
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

  const cleanDate = data?.snapshot
    ? new Date(
        Math.max(
          ...Object.values(data.snapshot).map((m) =>
            new Date(m.time).getTime(),
          ),
        ),
      ).toISOString()
    : "";
  console.log(cleanDate);
  const latestHorometro =
    horometro.length > 0 ? horometro[horometro.length - 1].value : 0;
  const horHoras = Math.floor(latestHorometro / 60);
  const horMinutos = Math.floor(latestHorometro % 60);

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
            title="Estanque 75 m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/cuevas/nivel"
            nivelMax={5}
            nivelAlarma={2}
          />
          <GraphCard
            isOpen
            title="Caudal"
            chartLabel="Caudal (l/s)"
            initialData={caudal}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/cuevas/caudal"
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
              fetchEndpoint="https://app.jteanalytics.cl/cuevas/voltaje"
              divisor={10}
            />
          </div>
          <div className="col-12 col-lg-6">
            <MultiLineGraphCard
              isOpen={true}
              title="Corriente"
              chartLabel="Corriente (A)"
              initialData={corrienteChartData}
              fetchEndpoint="https://app.jteanalytics.cl/cuevas/corriente"
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
            fetchEndpoint="https://app.jteanalytics.cl/cuevas/nivel"
            nivelMax={5}
            nivelAlarma={2}
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
            fetchEndpoint="https://app.jteanalytics.cl/cuevas/caudal"
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
            fetchEndpoint="https://app.jteanalytics.cl/cuevas/voltaje"
            divisor={10}
          />
          <MultiLineGraphCard
            isOpen={isOpenBomba}
            title="Corriente"
            chartLabel="Corriente (A)"
            initialData={corrienteChartData}
            fetchEndpoint="https://app.jteanalytics.cl/cuevas/corriente"
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
      {isLargeScreen ? <DesktopView /> : <MobileView />}
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default App;
