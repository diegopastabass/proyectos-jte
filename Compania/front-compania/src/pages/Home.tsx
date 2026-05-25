import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import State, { StateBody } from "../components/States";
import "../index.css";
import Loading from "./Loading";
import DropdownCard from "../components/DropdownCard";
import Error from "./Error";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import lgoJte from "../assets/logoJte.png";
import { fetchWithCache } from "../components/fetchWithcache";
import DropdownCardv2 from "../components/DropDownCardv2";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  SALA_BOMBAS_NIVEL_METROS: Metric;
  SALA_BOMBAS_FUNCIONANDO: Metric;
  SALA_BOMBAS_COM_CERRO: Metric;
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
  const [horometro, setHorometro] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);

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
        const [snapshotRes, nivelEstanque1Res] = await Promise.all([
          fetch("https://app.jteanalytics.cl/compania/snapshot"),
          fetch(`https://app.jteanalytics.cl/compania/nivel`),
        ]);

        const snapshotData: Datos = await snapshotRes.json();
        setHorometro(await fetchWithCache("horometro", date));

        setData(snapshotData);
        setNivelEstanque1(await nivelEstanque1Res.json());
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
            <ScadaDiagram data={data} />
          </div>
        </div>

        <div className="col-12 col-lg-4 order-1 order-lg-2 d-flex flex-column gap-1 mb-1">
          <DropdownCard
            isOpen={true}
            title="Estanque"
            chartLabel="Nivel del Estanque (m)"
            data={nivelEstanque1}
            nivelMax={6}
            nivelAlarma={3.5}
          />
          <DropdownCardv2
            isOpen={true}
            title="Horometro"
            chartLabel="Horometro"
            data={horometro}
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
                `${data.snapshot.SALA_BOMBAS_NIVEL_METROS.value.toFixed(2)} m`,
              ]}
              text2={["Tiempo Vaciado", `${data.tiempo_vaciado_formatted}`]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.SALA_BOMBAS_NIVEL_METROS.value}
              nivelMaximo={5}
            />
          </Card>
        </div>

        <div className="mb-2">
          <DropdownCard
            isOpen={true}
            title="Estanque"
            chartLabel="Nivel (m)"
            data={nivelEstanque1}
            nivelMax={6}
            nivelAlarma={3.5}
          />
        </div>

        <div className="mb-2">
          <DropdownCardv2
            isOpen={true}
            title="Horometro"
            chartLabel="Horometro"
            data={horometro}
          />
        </div>

        {/* Estado */}
        <div className="mb-2">
          <State>
            <StateBody
              automatico={data.snapshot.SALA_BOMBAS_COM_CERRO.value.toString()}
              bomba={data.snapshot.SALA_BOMBAS_FUNCIONANDO.value.toString()}
              falla={data.snapshot.SALA_BOMBAS_FUNCIONANDO.value.toString()}
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
