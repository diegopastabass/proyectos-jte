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

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  bomba_pozo: Metric;
  bomba_elevadora_1: Metric;
  bomba_elevadora_2: Metric;
  totalizador_pozo: Metric;
  caudal_pozo: Metric;
  freatico: Metric;
  totalizador_sentina: Metric;
  horometro_bomba_pozo: Metric;
  horometro_elevadora_1: Metric;
  horometro_elevadora_2: Metric;
  estanque: Metric;
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
  const [horometroPozo, setHorometroPozo] = useState<Metric[]>([]);
  const [totalizadorPozo, setTotalizadorPozo] = useState<Metric[]>([]);
  const [horometroElevadora1, setHorometroElevadora1] = useState<Metric[]>([]);
  const [horometroElevadora2, setHorometroElevadora2] = useState<Metric[]>([]);
  const [totalizadorSentina, setTotalizadorSentina] = useState<Metric[]>([]);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenSentina, setIsOpenSentina] = useState(isLargeScreen);
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
          fetch("https://app.jteanalytics.cl/trinidad/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/trinidad/nivel?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/trinidad/caudal?start=${date}&end=${date}`,
          ),
        ]);

        const snapshotData: Datos = await snapshotRes.json();

        setData(snapshotData);
        setNivelEstanque1(await nivelEstanque1Res.json());
        setCaudal(await caudalRes.json());
        setTotalizadorPozo(await fetchWithCache("totalizador_pozo", date));
        setTotalizadorSentina(
          await fetchWithCache("totalizador_sentina", date),
        );
        setHorometroPozo(await fetchWithCache("horometro_pozo", date));
        setHorometroElevadora1(await fetchWithCache("horometro_e1", date));
        setHorometroElevadora2(await fetchWithCache("horometro_e2", date));
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
  const latestHorometroPozo =
    horometroPozo.length > 0
      ? horometroPozo[horometroPozo.length - 1].value
      : 0;
  const horHorasPozo = Math.floor(latestHorometroPozo / 60);
  const horMinutosPozo = Math.floor(latestHorometroPozo % 60);

  const latestHorometroElevadora1 =
    horometroElevadora1.length > 0
      ? horometroElevadora1[horometroElevadora1.length - 1].value
      : 0;
  const horHorasElevadora1 = Math.floor(latestHorometroElevadora1 / 60);
  const horMinutosElevadora1 = Math.floor(latestHorometroElevadora1 % 60);

  const latestHorometroElevadora2 =
    horometroElevadora2.length > 0
      ? horometroElevadora2[horometroElevadora2.length - 1].value
      : 0;
  const horHorasElevadora2 = Math.floor(latestHorometroElevadora2 / 60);
  const horMinutosElevadora2 = Math.floor(latestHorometroElevadora2 % 60);

  const latestTotalizadorPozo =
    totalizadorPozo.length > 0
      ? totalizadorPozo[totalizadorPozo.length - 1].value
      : 0;

  const latestTotalizadorSentina =
    totalizadorSentina.length > 0
      ? totalizadorSentina[totalizadorSentina.length - 1].value
      : 0;

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
              horometroPozo={horometroPozo}
              horometroElevadora1={horometroElevadora1}
              horometroElevadora2={horometroElevadora2}
              totalizadorPozo={totalizadorPozo}
              totalizadorSentina={totalizadorSentina}
            />
          </div>
        </div>

        <div className="col-12 col-lg-4 order-1 order-lg-2 mb-1">
          <GraphCard
            isOpen={true}
            title="Estanque 100 m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/trinidad/nivel"
            nivelMax={5}
            nivelAlarma={2}
            divisor={100}
          />

          <div className="mt-2">
            <GraphCard
              isOpen
              title="Caudal"
              chartLabel="Caudal (l/s)"
              initialData={caudal}
              type="caudal"
              fetchEndpoint="https://app.jteanalytics.cl/trinidad/caudal"
              nivelMax={50}
              divisor={100}
            />
          </div>
        </div>

        <div className="w-100 row g-2 p-0 order-3 justify-content-center mt-2">
          <div className="col-12 col-lg-6">
            <GraphCard
              isOpen
              title="Totalizador Pozo"
              chartLabel="Totalizador (m³)"
              initialData={totalizadorPozo}
              type="totalizador"
            />
          </div>
          <div className="col-12 col-lg-6">
            <GraphCard
              isOpen
              title="Totalizador Sentina"
              chartLabel="Totalizador (m³)"
              initialData={totalizadorSentina}
              type="totalizador"
            />
          </div>
        </div>

        <div className="w-100 row g-2 p-0 order-4 justify-content-center mt-2">
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Horómetro Pozo"
              chartLabel="Horómetro"
              initialData={horometroPozo}
              type="horometro"
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Horómetro Elevadora 1"
              chartLabel="Horómetro"
              initialData={horometroElevadora1}
              type="horometro"
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Horómetro Elevadora 2"
              chartLabel="Horómetro"
              initialData={horometroElevadora2}
              type="horometro"
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
              title="Estanque 100 m³"
              text1={[
                "Nivel",
                `${(data.snapshot.estanque.value / 100).toFixed(2)} m`,
              ]}
              text2={["Tiempo Vaciado", `${data.tiempo_vaciado_formatted}`]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.estanque.value / 100}
              nivelMaximo={4.2}
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
            title="Estanque 100 m³"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/trinidad/nivel"
            nivelMax={4.2}
            nivelAlarma={2}
            divisor={100}
          />
        </div>

        {/* Bomba */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Bomba Pozo"
              text1={[
                "Caudal Impulsión",
                `${data.snapshot.caudal_pozo.value.toFixed(2)} l/s`,
              ]}
              text2={[
                "Nivel Freático",
                `${(data.snapshot.freatico.value / 100).toFixed(2)} m`,
              ]}
              text4={["Horómetro Pozo", `${horHorasPozo}:${horMinutosPozo} h`]}
              text5={["Totalizador Diario Pozo", `${latestTotalizadorPozo} m³`]}
              text6={[
                "Totalizador Total Pozo",
                `${data.snapshot.totalizador_pozo.value.toFixed(2)} m³`,
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
            title="Caudal Pozo"
            chartLabel="Caudal (l/s)"
            initialData={caudal}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/trinidad/caudal"
            nivelMax={12}
          />
          <GraphCard
            isOpen={isOpenBomba}
            title="Horómetro Pozo"
            chartLabel="Horómetro"
            initialData={horometroPozo}
            type="horometro"
          />
          <GraphCard
            isOpen={isOpenBomba}
            title="Totalizador Pozo"
            chartLabel="Totalizador (m³)"
            initialData={totalizadorPozo}
            type="totalizador"
          />
        </div>

        {/* Sentina */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Sentina"
              text1={[
                "Horómetro Elevadora 1",
                `${horHorasElevadora1}:${horMinutosElevadora1} h`,
              ]}
              text2={[
                "Horómetro Elevadora 2",
                `${horHorasElevadora2}:${horMinutosElevadora2} h`,
              ]}
              text3={[
                "Totalizador Diario Sentina",
                `${latestTotalizadorSentina} m³`,
              ]}
              text4={[
                "Totalizador Total Sentina",
                `${data.snapshot.totalizador_sentina.value.toFixed(2)} m³`,
              ]}
            />
            <ToggleCardButton
              isOpen={isOpenSentina}
              onToggle={() => setIsOpenSentina(!isOpenSentina)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenSentina}
            title="Horómetro Elevadora 1"
            chartLabel="Horómetro"
            initialData={horometroElevadora1}
            type="horometro"
          />
          <GraphCard
            isOpen={isOpenSentina}
            title="Horómetro Elevadora 2"
            chartLabel="Horómetro"
            initialData={horometroElevadora2}
            type="horometro"
          />
          <GraphCard
            isOpen={isOpenSentina}
            title="Totalizador Sentina"
            chartLabel="Totalizador (m³)"
            initialData={totalizadorSentina}
            type="totalizador"
          />
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
