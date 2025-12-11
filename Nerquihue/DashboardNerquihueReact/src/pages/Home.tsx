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
import logoJte from "../assets/logoJte.png";

// Interfaces
interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface Datos {
  automatico: Metric;
  bomba: Metric;
  caudal: Metric;
  estanque: Metric;
  falla: Metric;
  freatico: Metric;
  horometro: Metric;
  totalizador: Metric;
}

interface Metric {
  value: number;
  time: string;
}

function App() {
  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);
  const [nivelChartData, setNivelData] = useState<Metric[]>([]);
  const [caudalChartData, setCaudalData] = useState<Metric[]>([]);
  const [totalizadorChartData, setTotalizadorData] = useState<Metric[]>([]);
  const [horometroChartData, setHorometroData] = useState<Metric[]>([]);

  // Estados de UI
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);
  const [isOpenEstanque, setIsOpenEstanque] = useState(true);
  const [isOpenBomba, setIsOpenBomba] = useState(true);

  // Manejo de Resize
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1500);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Carga de Datos
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const now = new Date();
    const end = formatter.format(now);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 15);
    const start = formatter.format(startDate);

    const fetchData = async () => {
      try {
        const [snapshotRes, totalizadorRes, horometroRes, nivelRes, caudalRes] =
          await Promise.all([
            fetch("https://app.jteanalytics.cl/nerquihue/snapshot"),
            fetch(
              `https://app.jteanalytics.cl/nerquihue/totalizador?start=${start}&end=${end}`
            ),
            fetch(
              `https://app.jteanalytics.cl/nerquihue/horometro?start=${start}&end=${end}`
            ),
            fetch(`https://app.jteanalytics.cl/nerquihue/nivel`),
            fetch(`https://app.jteanalytics.cl/nerquihue/caudal`),
          ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setTotalizadorData(await totalizadorRes.json());
        setHorometroData(await horometroRes.json());
        setNivelData(await nivelRes.json());
        setCaudalData(await caudalRes.json());
      } catch (error) {
        console.error("Error al cargar datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 120000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading) return <Loading />;
  if (!data) return <Error />;

  // Helpers
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
      "0"
    )}`;
  };

  // =====================
  // VISTA MÓVIL
  // =====================
  const VistaMovil = () => (
    <>
      {/* Estanque */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque 30 m³"
            text1={`Nivel: ${data.snapshot.estanque.value.toFixed(2)} m`}
            text2={`Volumen Actual: ${(
              (60 / 7) *
              data.snapshot.estanque.value
            ).toFixed(2)} m³`}
            text3={data.tiempo_vaciado_formatted}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.estanque.value}
            nivelMaximo={3.5}
          />
          <ToggleCardButton
            isOpen={isOpenEstanque}
            onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanque}
          title="Estanque"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelAlarma={1.7}
        />
      </div>

      {/* Bomba */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Bomba"
            text1={`Caudal Impulsión: ${data.snapshot.caudal.value.toFixed(
              2
            )} l/s`}
            text2={`Nivel Freático: ${(
              data.snapshot.freatico.value / 100
            ).toFixed(2)} m`}
            text4={`Horómetro: ${minutesToHHMM(ultimoHorometro)}`}
            text5={`Totalizador Diario: ${ultimoTotalizador.toFixed(2)} m³`}
            text6={`Totalizador Total: ${data.snapshot.totalizador.value.toFixed(
              2
            )} m³`}
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
          nivelMax={5}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenBomba}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometroChartData}
          />
        </div>
        <div className="my-2">
          <DropdownCardv3
            isOpen={isOpenBomba}
            title="Totalizador Diario"
            chartLabel="Totalizador en m³"
            data={totalizadorChartData}
          />
        </div>
      </div>

      {/* Estados */}
      <div className="col-12">
        <State>
          <StateBody
            automatico={"1"}
            bomba={data.snapshot.bomba.value.toString()}
            falla={data.snapshot.falla.value.toString()}
          />
        </State>
      </div>
    </>
  );

  // =====================
  // VISTA DESKTOP
  // =====================
  const VistaDesktop = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr auto", // Filas superiores iguales, inferior auto
        gap: "1rem",
        width: "100%",
        maxWidth: "2400px",
        margin: "0 auto",
      }}
    >
      {/* Diagrama SCADA (Cubre cols 1-2, rows 1-2) */}
      <div style={{ gridColumn: "1 / 3", gridRow: "1 / 3" }}>
        <div className="card w-100 p-4 justify-content-center">
          <ScadaDiagram
            data={data}
            hor={ultimoHorometro.toFixed(2)}
            tot={ultimoTotalizador.toFixed(2)}
          />
        </div>
      </div>

      {/* Nivel Estanque (Col 3, Row 1) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelAlarma={1.7}
        />
      </div>

      {/* Caudal (Col 3, Row 2) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudalChartData}
          nivelMax={5}
        />
      </div>

      {/* Fila Inferior Compartida (Horómetro y Totalizador) */}
      <div
        style={{
          gridColumn: "1 / -1", // Abarca todo el ancho
          gridRow: "3",
          display: "flex",
          gap: "1rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <DropdownCardv2
            isOpen={true}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometroChartData}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DropdownCardv3
            isOpen={true}
            title="Totalizador Diario"
            chartLabel="Totalizador en m³"
            data={totalizadorChartData}
          />
        </div>
      </div>
    </div>
  );

  // =====================
  // RENDER PRINCIPAL
  // =====================
  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar text={data?.snapshot.estanque.time}>
            <button
              className="btn btn-outline-primary bi bi-save"
              onClick={() => setIsOpenExport(true)}
            ></button>
          </Navbar>
        </div>

        <div className="flex-grow-1 w-100 d-flex flex-column align-items-center px-3">
          {isLargeScreen ? (
            <VistaDesktop />
          ) : (
            <div className="row w-100" style={{ maxWidth: "800px" }}>
              <VistaMovil />
            </div>
          )}
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
