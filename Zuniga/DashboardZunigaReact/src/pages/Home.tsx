import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import State, { StateBody } from "../components/States";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import DropdownCard from "../components/DropdownCard";
import Error from "./Error";
import DropdownCardv2 from "../components/DropDownCardv2";
import DropdownCardv3 from "../components/DropDownCardv3";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import lgoJte from "../assets/logoJte.png";
import { fetchWithCache } from "../components/fetchWithcache";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  falla: Metric;
  bomba: Metric;
  automatico: Metric;
  estanque: Metric;
  estanque_2: Metric;
  caudal: Metric;
  freatico: Metric;
  presion: Metric;
  horometro: Metric;
  totalizador: Metric;
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
  const [nivelEstanque2, setNivelEstanque2] = useState<Metric[]>([]);
  const [caudal, setCaudal] = useState<Metric[]>([]);
  const [horometro, setHorometro] = useState<Metric[]>([]);
  const [totalizador, setTotalizador] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenEstanque2, setIsOpenEstanque2] = useState(isLargeScreen);
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
        const [snapshotRes, nivelEstanque1Res, nivelEstanque2Res, caudalRes] =
          await Promise.all([
            fetch("https://app.jteanalytics.cl/zuniga/snapshot"),
            fetch(
              `https://app.jteanalytics.cl/zuniga/nivel?start=${date}&end=${date}`,
            ),
            fetch(
              `https://app.jteanalytics.cl/zuniga/nivel2?start=${date}&end=${date}`,
            ),
            fetch(
              `https://app.jteanalytics.cl/zuniga/caudal?start=${date}&end=${date}`,
            ),
          ]);

        const snapshotData: Datos = await snapshotRes.json();

        setData(snapshotData);
        setNivelEstanque1(await nivelEstanque1Res.json());
        setNivelEstanque2(await nivelEstanque2Res.json());
        setCaudal(await caudalRes.json());
        setTotalizador(await fetchWithCache("totalizador", date));
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

        <div className="col-12 col-lg-4 order-1 order-lg-2 mb-1">
          <DropdownCard
            isOpen={true}
            title="Estanque 350 m³"
            chartLabel="Nivel del Estanque (m)"
            data={nivelEstanque1}
            nivelMax={7}
            nivelAlarma={2}
          />
          <DropdownCard
            isOpen={true}
            title="Estanque 2 m³"
            chartLabel="Nivel del Estanque (m)"
            data={nivelEstanque2}
            nivelMax={2}
          />
        </div>

        <div className="w-100 row g-2 p-0 order-2 justify-content-center">
          <div className="col-12 col-lg-4">
            <DropdownCard
              isOpen
              title="Caudal"
              chartLabel="Caudal (l/s)"
              data={caudal}
              nivelMax={50}
            />
          </div>
          <div className="col-12 col-lg-4">
            <DropdownCardv2
              isOpen
              title="Horómetro Diario"
              chartLabel="Horómetro"
              data={horometro}
            />
          </div>
          <div className="col-12 col-lg-4">
            <DropdownCardv3
              isOpen
              title="Totalizador Diario"
              chartLabel="Totalizador (m³)"
              data={totalizador}
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
              title="Estanque 350 m³"
              text1={["Nivel", `${data.snapshot.estanque.value.toFixed(2)} m`]}
              text2={["Tiempo Vaciado", `${data.tiempo_vaciado_formatted}`]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.estanque.value}
              nivelMaximo={7}
            />
            <ToggleCardButton
              isOpen={isOpenEstanque}
              onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <DropdownCard
            isOpen={isOpenEstanque}
            title="Estanque 350 m³"
            chartLabel="Nivel (m)"
            data={nivelEstanque1}
            nivelMax={7}
            nivelAlarma={2}
          />
        </div>

        {/* Estanque 2 */}
        <div className="mb-2">
          <Card>
            <CardBody
              title="Estanque 2 m³"
              text1={[
                "Nivel",
                `${data.snapshot.estanque_2.value.toFixed(2)} m`,
              ]}
            />
            <TankLevelCircular
              nivelActual={data.snapshot.estanque_2.value}
              nivelMaximo={2}
            />
            <ToggleCardButton
              isOpen={isOpenEstanque2}
              onToggle={() => setIsOpenEstanque2(!isOpenEstanque2)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <DropdownCard
            isOpen={isOpenEstanque2}
            title="Estanque 2 m³"
            chartLabel="Nivel (m)"
            data={nivelEstanque2}
            nivelMax={2}
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
              text2={[
                "Nivel Freático",
                `${(data.snapshot.freatico.value / 100).toFixed(2)} m`,
              ]}
              text3={[
                "Presión",
                `${(data.snapshot.presion.value / 10).toFixed(1)} bar`,
              ]}
              text4={["Horómetro", `${horHoras}:${horMinutos} h`]}
              text5={["Totalizador Diario", `${latestTotalizador} m³`]}
              text6={[
                "Totalizador Total",
                `${data.snapshot.totalizador.value.toFixed(2)} m³`,
              ]}
            />
            <ToggleCardButton
              isOpen={isOpenBomba}
              onToggle={() => setIsOpenBomba(!isOpenBomba)}
            />
          </Card>
        </div>

        <div className="mb-2">
          <DropdownCard
            isOpen={isOpenBomba}
            title="Caudal"
            chartLabel="Caudal (l/s)"
            data={caudal}
            nivelMax={50}
          />
          <DropdownCardv2
            isOpen={isOpenBomba}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometro}
          />
          <DropdownCardv3
            isOpen={isOpenBomba}
            title="Totalizador Diario"
            chartLabel="Totalizador (m³)"
            data={totalizador}
          />
        </div>

        {/* Estado */}
        <div className="mb-2">
          <State>
            <StateBody
              automatico={data.snapshot.automatico.value.toString()}
              bomba={data.snapshot.bomba.value.toString()}
              falla={data.snapshot.falla.value.toString()}
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
