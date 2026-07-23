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
  totalizador_1: Metric;
  totalizador_2: Metric;
  totalizador_pozo: Metric;

  caudal_1: Metric;
  caudal_2: Metric;
  caudal_pozo: Metric;

  horometro_pozo: Metric;

  presion_1: Metric;
  presion_2: Metric;

  nivel_1: Metric;
  nivel_2: Metric;

  freatico: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
  tiempo_vaciado_est_2: number;
  tiempo_vaciado_est_2_formatted: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);

  const [nivelEstanque1, setNivelEstanque1] = useState<Metric[]>([]);
  const [nivelEstanque2, setNivelEstanque2] = useState<Metric[]>([]);
  const [caudal1, setCaudal1] = useState<Metric[]>([]);
  const [caudal2, setCaudal2] = useState<Metric[]>([]);
  const [caudalPozo, setCaudalPozo] = useState<Metric[]>([]);

  const [totalizador1, setTotalizador1] = useState<Metric[]>([]);
  const [totalizador2, setTotalizador2] = useState<Metric[]>([]);
  const [totalizadorPozo, setTotalizadorPozo] = useState<Metric[]>([]);

  const [horometroPozo, setHorometroPozo] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenEstanque2, setIsOpenEstanque2] = useState(isLargeScreen);

  const [isOpenPozo, setIsOpenPozo] = useState(isLargeScreen);
  const [isOpenBomba1, setIsOpenBomba1] = useState(isLargeScreen);
  const [isOpenBomba2, setIsOpenBomba2] = useState(isLargeScreen);

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
        const [
          snapshotRes,
          nivelEstanque1Res,
          nivelEstanque2Res,
          caudal1Res,
          caudal2Res,
          caudalPozoRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/hornillas/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/hornillas/nivel?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/hornillas/nivel2?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/hornillas/caudal?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/hornillas/caudal2?start=${date}&end=${date}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/hornillas/caudal_pozo?start=${date}&end=${date}`,
          ),
        ]);

        const snapshotData: Datos = await snapshotRes.json();

        setData(snapshotData);
        setNivelEstanque1(await nivelEstanque1Res.json());
        setNivelEstanque2(await nivelEstanque2Res.json());
        setCaudal1(await caudal1Res.json());
        setCaudal2(await caudal2Res.json());
        setCaudalPozo(await caudalPozoRes.json());

        setHorometroPozo(await fetchWithCache("horometro_pozo", date));

        setTotalizador1(await fetchWithCache("totalizador", date));
        setTotalizador2(await fetchWithCache("totalizador2", date));
        setTotalizadorPozo(await fetchWithCache("totalizador_pozo", date));
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

  const latestTotalizador1 =
    totalizador1.length > 0 ? totalizador1[totalizador1.length - 1].value : 0;

  const latestTotalizador2 =
    totalizador2.length > 0 ? totalizador2[totalizador2.length - 1].value : 0;

  const latestTotalizadorPozo =
    totalizadorPozo.length > 0
      ? totalizadorPozo[totalizadorPozo.length - 1].value
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
              totalizador1={totalizador1}
              totalizador2={totalizador2}
              totalizadorPozo={totalizadorPozo}
            />
          </div>
        </div>

        <div className="col-12 col-lg-4 order-1 order-lg-2 mb-1">
          <GraphCard
            isOpen={true}
            title="Estanque 50m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/nivel"
            nivelMax={5}
            nivelAlarma={1.5}
          />
          <GraphCard
            isOpen={true}
            title="Estanque 100m³"
            chartLabel="Nivel del Estanque (m)"
            initialData={nivelEstanque2}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/nivel2"
            nivelMax={5}
            nivelAlarma={1.5}
          />
        </div>

        <div className="w-100 row g-2 p-0 order-2 justify-content-center">
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Caudal (Estanque 50m³)"
              chartLabel="Caudal (l/s)"
              initialData={caudal1}
              type="caudal"
              fetchEndpoint="https://app.jteanalytics.cl/hornillas/caudal"
              nivelMax={20}
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Caudal (Estanque 100m³)"
              chartLabel="Caudal (l/s)"
              initialData={caudal2}
              type="caudal"
              fetchEndpoint="https://app.jteanalytics.cl/hornillas/caudal2"
              nivelMax={20}
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Caudal Pozo"
              chartLabel="Caudal (l/s)"
              initialData={caudalPozo}
              type="caudal"
              fetchEndpoint="https://app.jteanalytics.cl/hornillas/caudal_pozo"
              nivelMax={20}
            />
          </div>

          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Totalizador Diario Estanque 50m³"
              chartLabel="Totalizador (m³)"
              initialData={totalizador1}
              type="totalizador"
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Totalizador Diario Estanque 100m³"
              chartLabel="Totalizador (m³)"
              initialData={totalizador2}
              type="totalizador"
            />
          </div>
          <div className="col-12 col-lg-4">
            <GraphCard
              isOpen
              title="Totalizador Diario Pozo"
              chartLabel="Totalizador (m³)"
              initialData={totalizadorPozo}
              type="totalizador"
            />
          </div>
          <div className="col-12">
            <GraphCard
              isOpen
              title="Horómetro Diario Pozo"
              chartLabel="Horómetro"
              initialData={horometroPozo}
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
              title="Estanque 50m³"
              text1={["Nivel", `${data.snapshot.nivel_1.value.toFixed(2)} m`]}
              text2={[
                "Tiempo Vaciado",
                `${data.tiempo_vaciado_est_1_formatted}`,
              ]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.nivel_1.value}
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
            title="Estanque 50m³"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque1}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/nivel"
            nivelMax={5}
            nivelAlarma={1.5}
          />
        </div>

        {/* Estanque 2 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Estanque 100m³"
              text1={["Nivel", `${data.snapshot.nivel_2.value.toFixed(2)} m`]}
              text2={[
                "Tiempo Vaciado",
                `${data.tiempo_vaciado_est_2_formatted}`,
              ]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.nivel_2.value}
              nivelMaximo={4}
            />
            <ToggleCardButton
              isOpen={isOpenEstanque2}
              onToggle={() => setIsOpenEstanque2(!isOpenEstanque2)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenEstanque2}
            title="Estanque 100m³"
            chartLabel="Nivel (m)"
            initialData={nivelEstanque2}
            type="nivel"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/nivel2"
            nivelMax={5}
            nivelAlarma={1.5}
          />
        </div>

        {/* Pozo */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Pozo"
              text1={[
                "Caudal Impulsión",
                `${data.snapshot.caudal_pozo.value.toFixed(2)} l/s`,
              ]}
              text2={[
                "Nivel Freático",
                `${(data.snapshot.freatico.value / 10).toFixed(2)} m`,
              ]}
              text3={["Horómetro Pozo", `${horHorasPozo}:${horMinutosPozo} h`]}
              text4={["Totalizador Pozo", `${latestTotalizadorPozo} m³`]}
            />
            <ToggleCardButton
              isOpen={isOpenPozo}
              onToggle={() => setIsOpenPozo(!isOpenPozo)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenPozo}
            title="Caudal Pozo"
            chartLabel="Caudal (l/s)"
            initialData={caudalPozo}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/caudal_pozo"
            nivelMax={20}
          />
          <GraphCard
            isOpen={isOpenPozo}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            initialData={horometroPozo}
            type="horometro"
          />
          <GraphCard
            isOpen={isOpenPozo}
            title="Totalizador Diario"
            chartLabel="Totalizador (m³)"
            initialData={totalizadorPozo}
            type="totalizador"
          />
        </div>

        {/* Bomba 1 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Salida a Estanque 50m³"
              text1={[
                "Caudal Impulsión",
                `${data.snapshot.caudal_1.value.toFixed(2)} l/s`,
              ]}
              text4={["Totalizador", `${latestTotalizador1} m³`]}
              text5={[
                "Presión",
                `${data.snapshot.presion_1.value.toFixed(2)} psi`,
              ]}
            />
            <ToggleCardButton
              isOpen={isOpenBomba1}
              onToggle={() => setIsOpenBomba1(!isOpenBomba1)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenBomba1}
            title="Caudal (Estanque 50m³)"
            chartLabel="Caudal (l/s)"
            initialData={caudal1}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/caudal_1"
            nivelMax={20}
          />

          <GraphCard
            isOpen={isOpenBomba1}
            title="Totalizador Diario"
            chartLabel="Totalizador (m³)"
            initialData={totalizador1}
            type="totalizador"
          />
        </div>

        {/* Bomba 2 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Salida a Estanque 100m³"
              text1={[
                "Caudal Impulsión",
                `${data.snapshot.caudal_2.value.toFixed(2)} l/s`,
              ]}
              text4={["Totalizador", `${latestTotalizador2} m³`]}
              text5={[
                "Presión",
                `${data.snapshot.presion_2.value.toFixed(2)} psi`,
              ]}
            />
            <ToggleCardButton
              isOpen={isOpenBomba2}
              onToggle={() => setIsOpenBomba2(!isOpenBomba2)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <GraphCard
            isOpen={isOpenBomba2}
            title="Caudal (Estanque 100m³)"
            chartLabel="Caudal (l/s)"
            initialData={caudal2}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/hornillas/caudal_2"
            nivelMax={20}
          />

          <GraphCard
            isOpen={isOpenBomba2}
            title="Totalizador Diario"
            chartLabel="Totalizador (m³)"
            initialData={totalizador2}
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
