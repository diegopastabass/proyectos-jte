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
import { fetchWithCache } from "../components/fetchWithcache";
import logoJte from "../assets/logoJte.png";

interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface Datos {
  automatico: Metric; //
  manual: Metric; //
  bomba: Metric; //
  temp: Metric; //
  petroleo: Metric; //
  rpm: Metric; //
  L1L2: Metric; //
  L2L3: Metric; //
  L3L1: Metric; //
  L1N: Metric; //
  L2N: Metric; //
  L3N: Metric; //
  I1: Metric; //
  I2: Metric; //
  I3: Metric; //
  PF: Metric; //
  KW1: Metric; //
  KW2: Metric; //
  KW3: Metric; //
  totalizador: Metric; //
  caudal: Metric; //
  estanque: Metric; //
  pozo: Metric; //
}

interface Metric {
  value: number;
  time: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);

  const [nivelChartData, setNivelData] = useState<Metric[]>([]);
  const [caudalChartData, setCaudalData] = useState<Metric[]>([]);

  const [totalizadorChartData, setTotalizador] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenBomba, setIsOpenBomba] = useState(isLargeScreen);

  const nivelMaxEstanque = 3;
  const nivelMaxCaudal = 10;
  const nivelAlarma = 1;

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
          fetch("https://app.jteanalytics.cl/auquinco/snapshot"),
          fetch(`https://app.jteanalytics.cl/auquinco/nivel`),
          fetch(`https://app.jteanalytics.cl/auquinco/caudal`),
        ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setNivelData(await nivelRes.json());
        setCaudalData(await caudalRes.json());

        setTotalizador(await fetchWithCache("totalizador", end));
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

  /*
  const ultimoHorometro =
    horometroChartData.length > 0
      ? horometroChartData[horometroChartData.length - 1].value
      : 0;*/
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
  const VistaMovil = () => (
    <>
      {/* Estanque 1 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque 1"
            text1={["Nivel", `${data.snapshot.estanque.value.toFixed(2)} m`]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.snapshot.estanque.value).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.estanque.value}
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
          title="Estanque 1"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelMax={nivelMaxEstanque}
          nivelAlarma={nivelAlarma}
        />
      </div>

      {/* Bomba */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Bomba"
            text1={[
              "Caudal Impulsión",
              `${data.snapshot.caudal.value.toFixed(2)} l/s`,
            ]}
            text2={[
              "Nivel Freático",
              `${(data.snapshot.pozo.value / 100).toFixed(2)} m`,
            ]}
            text5={[
              "Totalizador por Día",
              `${ultimoTotalizador.toFixed(2)} m³`,
            ]}
            text6={[
              "Totalizador",
              `${data.snapshot.totalizador.value.toFixed(2)} m³`,
            ]}
          />
          <ToggleCardButton
            isOpen={isOpenBomba}
            onToggle={() => setIsOpenBomba(!isOpenBomba)}
          />
        </Card>
        <DropdownCard
          isOpen={isOpenBomba}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudalChartData}
          nivelMax={nivelMaxCaudal}
        />
        <DropdownCardv3
          isOpen={isOpenBomba}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizadorChartData}
        />{" "}
      </div>

      {/* Panel de Estados */}
      <States
        title="Estado Tablero Planta 1"
        automatico_p1={data.snapshot.automatico.value.toString()}
        asimetria_p1={data.snapshot.asimetria.value.toString()}
        bomba_p1={data.snapshot.bomba_p1.value.toString()}
        falla_p1={data.snapshot.falla_p1.value.toString()}
      />

      <States
        title="Estado Tablero Planta 2"
        automatico={data.snapshot.automatico.value.toString()}
        falla={data.snapshot.falla.value.toString()}
        bomba={data.snapshot.bomba.value.toString()}
      />

      <States
        title="Estado Presurizadora"
        falla_vdf1_p1={data.snapshot.falla_vdf1_p1.value.toString()}
        falla_vdf2_p1={data.snapshot.falla_vdf2_p1.value.toString()}
        presion={data.snapshot.presion.value.toFixed(2)}
      />
    </>
  );

  // =====================
  // VISTA DESKTOP
  // =====================
  const VistaDesktop = () => (
    <div
      className="desktop-grid w-100"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr 1fr",
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

      {/* Horómetro (0,2) */}
      <div style={{ gridColumn: "1", gridRow: "3" }}>
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario"
          chartLabel="Horómetro"
          data={horometroChartData}
        />
      </div>

      {/* Totalizador (1,2) */}
      <div style={{ gridColumn: "2", gridRow: "3" }}>
        <DropdownCardv3
          isOpen={true}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizadorChartData}
        />
      </div>

      {/* Estanque 1 (2,0) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Nuevo"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelMax={350}
          nivelAlarma={50}
        />
      </div>

      {/* Estanque 2 (2,1) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Antiguo"
          chartLabel="Nivel del Estanque (m)"
          data={nivel2ChartData}
          nivelMax={3.5}
          nivelAlarma={0.5}
        />
      </div>

      {/* Caudal (2,2) */}
      <div style={{ gridColumn: "3", gridRow: "3" }}>
        <DropdownCard
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudalChartData}
          nivelMax={nivelMaxCaudal}
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar text={data.snapshot.caudal.time}>
            <button
              className="btn btn-outline-primary bi bi-save"
              onClick={() => setIsOpenExport(true)}
            ></button>
          </Navbar>
        </div>
        <div className="flex-grow-1 w-100 d-flex flex-column align-items-center px-3">
          {isLargeScreen ? <VistaDesktop /> : <VistaMovil />}
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
