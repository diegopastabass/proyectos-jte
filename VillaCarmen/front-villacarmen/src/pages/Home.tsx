import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import States from "../components/States";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import DropdownCard from "../components/DropdownCard";
import DropdownCardv2 from "../components/DropDownCardv2";
import DropdownCardv3 from "../components/DropDownCardv3";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import Error from "./Error";
import "../index.css";
import { fetchWithCache } from "../components/fetchWithcache";
import logoJte from "../assets/logoJte.png";

interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface Datos {
  bomba: Metric;
  automatico: Metric;
  falla: Metric;
  totalizador: Metric;
  horometro: Metric;
  freatico: Metric;
  estanque: Metric;
  solar: Metric;
  caudal: Metric;
}

interface Metric {
  value: number;
  time: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);

  const [nivelChartData, setNivelData] = useState<Metric[]>([]);

  const [totalizadorChartData, setTotalizador] = useState<Metric[]>([]);
  const [horometroChartData, setHorometro] = useState<Metric[]>([]);
  const [caudalChartData, setCaudal] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenBomba, setIsOpenBomba] = useState(isLargeScreen);

  const nivelMaxEstanque = 3.6;
  const nivelAlarma = 150;

  const handleResize = () => setIsLargeScreen(window.innerWidth >= 1500);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize();

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const now = new Date();
    const end = formatter.format(now);

    const fetchData = async () => {
      try {
        const [snapshotRes, nivelRes, caudalRes] = await Promise.all([
          fetch("https://app.jteanalytics.cl/villacarmen/snapshot"),
          fetch(`https://app.jteanalytics.cl/villacarmen/nivel`),
          fetch(`https://app.jteanalytics.cl/villacarmen/caudal`),
        ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setNivelData(await nivelRes.json());
        setCaudal(await caudalRes.json());

        setTotalizador(await fetchWithCache("totalizador", end));
        setHorometro(await fetchWithCache("horometro", end));
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

  const ultimoHorometro =
    horometroChartData.length > 0
      ? horometroChartData[horometroChartData.length - 1].value
      : 0;
  const ultimoTotalizador =
    totalizadorChartData.length > 0
      ? totalizadorChartData[totalizadorChartData.length - 1].value
      : 0;

  const minutesToHHMM = (mins: number): string => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}`;
  };

  // =====================
  // VISTA MÓVIL
  // =====================
  const vistaMovil = (
    <>
      {/* Estanque 1 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque 1"
            text1={[
              "Nivel",
              `${(data.snapshot.estanque.value / 100).toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${(((70 / 3.6) * data.snapshot.estanque.value) / 100).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vaciado", data.tiempo_vaciado_formatted]}
            text4={[
              "☼ Voltaje",
              `${(data.snapshot.solar.value / 1000).toFixed(2)} V`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.estanque.value / 100}
            nivelMaximo={nivelMaxEstanque}
          />
          <ToggleCardButton
            isOpen={isOpenEstanque}
            onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
          />
        </Card>
        <DropdownCard
          className="mb-4 d-below-1500-none d-1500-block"
          isOpen={isOpenEstanque}
          title="Estanque 70m³"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          divisor={100}
          nivelMax={nivelMaxEstanque}
          nivelAlarma={nivelAlarma}
        />
      </div>
      {/* Bomba */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Bomba"
            text2={[
              "Nivel Freático",
              `${(data.snapshot.freatico.value / 100).toFixed(2)} m`,
            ]}
            text3={[
              "Totalizador por Día",
              `${ultimoTotalizador.toFixed(2)} m³`,
            ]}
            text4={[
              "Totalizador",
              `${data.snapshot.totalizador.value.toFixed(2)} m³`,
            ]}
            text5={["Horómetro Diario", minutesToHHMM(ultimoHorometro)]}
            text6={[
              "Horómetro Total",
              minutesToHHMM(data.snapshot.horometro.value),
            ]}
            text7={[
              "Caudal",
              `${(data.snapshot.caudal.value / 1000).toFixed(2)} l/s`,
            ]}
          />
          <ToggleCardButton
            isOpen={isOpenBomba}
            onToggle={() => setIsOpenBomba(!isOpenBomba)}
          />
        </Card>
        <DropdownCardv3
          isOpen={isOpenBomba}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizadorChartData}
        />{" "}
        <DropdownCardv2
          isOpen={isOpenBomba}
          title="Horómetro"
          chartLabel="Horómetro"
          data={horometroChartData}
        />
        <DropdownCard
          isOpen={isOpenBomba}
          title="Caudal"
          chartLabel="Caudal"
          data={caudalChartData}
          divisor={1000}
          nivelMax={30}
        />
      </div>
      {/* Panel de Estados */}
      <States
        title="Estado Tablero"
        automatico={data.snapshot.automatico.value.toString()}
        bomba={data.snapshot.bomba.value.toString()}
      />
    </>
  );

  // =====================
  // VISTA DESKTOP
  // =====================
  const vistaDesktop = (
    <div
      className="desktop-grid w-100"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr 1fr",
        gap: "1rem",
        width: "100%",
        maxWidth: "2400px",
        margin: "0 auto",
      }}
    >
      {/* Diagrama SCADA (ocupa 0,0; 0,1; 1,0; 1,1) */}
      <div style={{ gridColumn: "1 / span 2", gridRow: "1 / span 2" }}>
        <div className="card w-100 p-4 justify-content-center">
          <ScadaDiagram
            data={data}
            hor={ultimoHorometro.toFixed(2)}
            tot={ultimoTotalizador.toFixed(2)}
          />
        </div>
      </div>
      {/* Estanque 1 (2,0) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque 70m³"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelMax={4}
          divisor={100}
          nivelAlarma={nivelAlarma}
        />
      </div>

      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          className="mb-4 d-below-1500-none d-1500-block"
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal (l/s)"
          data={caudalChartData}
          divisor={1000}
          nivelMax={30}
        />
      </div>

      {/* Horómetro + Totalizador (row 3, 50/50) */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "3",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario"
          chartLabel="Horómetro"
          data={horometroChartData}
        />
        <DropdownCardv3
          isOpen={true}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizadorChartData}
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar text={data.snapshot.estanque.time}>
            <button
              className="btn btn-outline-primary bi bi-save"
              onClick={() => setIsOpenExport(true)}
            ></button>
          </Navbar>
        </div>
        <div className="flex-grow-1 w-100 d-flex flex-column align-items-center px-3">
          {isLargeScreen ? vistaDesktop : vistaMovil}
        </div>
        <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
          <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img src={logoJte} alt="logo" width={40} height={24} />
        </footer>
      </div>

      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default App;
