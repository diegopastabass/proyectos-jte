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

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  asimetria: Metric;
  bomba: Metric;
  caudal: Metric;
  estanque: Metric;
  falla: Metric;
  freatico: Metric;
  horometro: Metric;
  pozo_seco: Metric;
  solar: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);

  const [nivelEstanque1, setNivelEstanque1] = useState<Metric[]>([]);
  const [caudal, setCaudal] = useState<Metric[]>([]);
  const [horometro, setHorometro] = useState<Metric[]>([]);

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
          fetch("https://app.jteanalytics.cl/manzano/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/manzano/nivel?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/manzano/caudal?start=${date}&end=${date}`,
          ),
        ]);

        const snapshotData: Datos = await snapshotRes.json();

        setData(snapshotData);
        setNivelEstanque1(await nivelEstanque1Res.json());
        setCaudal(await caudalRes.json());
        setHorometro(await fetchWithCache("horometro", date));
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
        className="w-100 px-3 pb-4"
        style={{
          maxWidth: "2200px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "1fr 1fr auto",
          gap: "1.5rem",
        }}
      >
        <div style={{ gridColumn: "1 / 3", gridRow: "1 / 3" }}>
          <div className="card w-100 p-4 h-100 d-flex flex-column">
            <ScadaDiagram data={data} horometro={horometro} />
          </div>
        </div>

        <div style={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}>
          <GraphCard
            isOpen={true}
            title="Estanque"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/manzano/nivel"
            nivelMax={450}
            nivelAlarma={200}
            divisor={100}
            height="100%"
          />
        </div>

        <div style={{ gridColumn: "3 / 4", gridRow: "2 / 3" }}>
          <GraphCard
            isOpen
            title="Caudal"
            chartLabel="Caudal (l/s)"
            initialData={caudal}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/manzano/caudal"
            nivelMax={300}
            divisor={10}
            height="100%"
          />
        </div>

        <div style={{ gridColumn: "1 / 4", gridRow: "3 / 4" }}>
          <GraphCard
            isOpen
            title="Horómetro Diario"
            chartLabel="Horómetro"
            initialData={horometro}
            type="horometro"
            height="250px"
          />
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
              title="Estanque"
              text1={[
                "Nivel",
                `${(data.snapshot.estanque.value / 100).toFixed(2)} m`,
              ]}
              text2={["Tiempo Vaciado", `${data.tiempo_vaciado_formatted}`]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.estanque.value / 100}
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
            title="Estanque"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/manzano/nivel"
            nivelMax={450}
            nivelAlarma={200}
            divisor={100}
          />
        </div>

        {/* Bomba */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Bomba"
              text1={[
                "Caudal Impulsión",
                `${(data.snapshot.caudal.value / 10).toFixed(2)} l/s`,
              ]}
              text2={[
                "Nivel Freático",
                `${(data.snapshot.freatico.value / 100).toFixed(2)} m`,
              ]}
              text4={["Horómetro", `${horHoras}:${horMinutos} h`]}
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
            fetchEndpoint="https://app.jteanalytics.cl/manzano/caudal"
            nivelMax={300}
            divisor={10}
          />
          <GraphCard
            isOpen={isOpenBomba}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            initialData={horometro}
            type="horometro"
          />
        </div>

        {/* Estado */}
        <div className="mb-2">
          <State>
            <StateBody
              asimetria={data.snapshot.asimetria.value.toString()}
              falla={data.snapshot.falla.value.toString()}
              bomba={data.snapshot.bomba.value.toString()}
              pozo_seco={data.snapshot.pozo_seco.value.toString()}
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
