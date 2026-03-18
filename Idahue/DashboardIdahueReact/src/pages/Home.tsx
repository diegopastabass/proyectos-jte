import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import States from "../components/States";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import DropdownCard from "../components/DropdownCard";
import Error from "./Error";
import DropdownCardv2 from "../components/DropDownCardv2";

import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import logoJte from "../assets/logoJte.png";

// Interfaces
interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado_pozo: number;
  tiempo_vaciado_formatted_pozo: string;
  tiempo_vaciado_sentina: number;
  tiempo_vaciado_formatted_sentina: string;
}

interface Datos {
  P1: P1;
  P2: P2;
}

interface P1 {
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  bomba: Metric;
}

interface P2 {
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  solar: Metric; // Dividir entre 1000
  bomba: Metric;
}

interface Metric {
  value: number;
  time: string;
}

function App() {
  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);
  const [nivelChartDataP1, setNivelChartDataP1] = useState<Metric[]>([]);
  const [nivelChartDataP2, setNivelChartDataP2] = useState<Metric[]>([]);
  const [horometroChartDataP1, setHorometroChartDataP1] = useState<Metric[]>(
    [],
  );
  const [horometroChartDataP2, setHorometroChartDataP2] = useState<Metric[]>(
    Metric[]
  >([]);

  // Estados de UI
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);
  const [isOpenEstanqueP1, setIsOpenEstanqueP1] = useState(true);
  const [isOpenEstanqueP2, setIsOpenEstanqueP2] = useState(true);

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
        const [
          snapshotRes,
          horometroP1Res,
          horometroP2Res,
          nivelP1Res,
          nivelP2Res,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/idahue/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/idahue/horometro_p1?start=${start}&end=${end}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/idahue/horometro_p2?start=${start}&end=${end}`,
          ),
          fetch(`https://app.jteanalytics.cl/idahue/nivel_p1`),
          fetch(`https://app.jteanalytics.cl/idahue/nivel_p2`),
        ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setHorometroChartDataP1(await horometroP1Res.json());
        setHorometroChartDataP2(await horometroP2Res.json());
        setNivelChartDataP1(await nivelP1Res.json());
        setNivelChartDataP2(await nivelP2Res.json());
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
  const ultimoHorometroP1 =
    horometroChartDataP1.length > 0
      ? horometroChartDataP1[horometroChartDataP1.length - 1].value
      : 0;

  const ultimoHorometroP2 =
    horometroChartDataP2.length > 0
      ? horometroChartDataP2[horometroChartDataP2.length - 1].value
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
      {/* Estanque Pozo*/}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque Pozo"
            text1={["Nivel", `${data.snapshot.P1.nivel.value.toFixed(2)} m`]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.snapshot.P1.nivel.value).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted_pozo]}
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroP1)} h`]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.P1.nivel.value}
            nivelMaximo={3.4}
          />
          <ToggleCardButton
            isOpen={isOpenEstanqueP1}
            onToggle={() => setIsOpenEstanqueP1(!isOpenEstanqueP1)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanqueP1}
          title="Estanque Pozo"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataP1}
          nivelAlarma={1.5}
          nivelMax={4}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenEstanqueP1}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometroChartDataP1}
          />
        </div>
      </div>
      {/* Estados Pozo */}
      <div className="col-12 mb-4">
        <States
          title="Estado Tablero Pozo"
          automatico={data.snapshot.P1.automatico.value.toString()}
          bomba={data.snapshot.P1.bomba.value.toString()}
        />
      </div>

      {/* Estanque Sentina*/}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque Cerro"
            text1={[
              "Nivel",
              `${(data.snapshot.P2.nivel.value / 100).toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${(((60 / 7) * data.snapshot.P2.nivel.value) / 100).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted_p2]}
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroP2)} h`]}
            text5={[
              "Solar",
              ` ${(data.snapshot.P2.solar.value / 1000).toFixed(2)} V`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.P2.nivel.value / 100}
            nivelMaximo={2.2}
          />
          <ToggleCardButton
            isOpen={isOpenEstanqueP2}
            onToggle={() => setIsOpenEstanqueP2(!isOpenEstanqueP2)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanqueP2}
          title="Estanque Cerro"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataP2}
          nivelAlarma={1}
          divisor={100}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenEstanqueP2}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometroChartDataP2}
          />
        </div>
      </div>
      {/* Estados Sentina */}
      <div className="col-12">
        <States
          title="Estado Tablero Sentina"
          automatico={data.snapshot.P2.automatico.value.toString()}
          bomba={data.snapshot.P2.bomba.value.toString()}
        />
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
        gridTemplateColumns: "repeat(6, 1fr)",
        gridTemplateRows: "1fr 1fr auto",
        gap: "1rem",
        width: "100%",
        maxWidth: "2400px",
        margin: "0 auto",
      }}
    >
      {/* SCADA */}
      <div style={{ gridColumn: "span 4", gridRow: "span 2" }}>
        <div className="card w-100 h-100 p-4 justify-content-center">
          <ScadaDiagram
            data={data}
            horSen={ultimoHorometroP2.toFixed(2)}
            horPoz={ultimoHorometroP1.toFixed(2)}
          />
        </div>
      </div>

      {/* Niveles */}
      <div style={{ gridColumn: "span 2", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Pozo"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataP1}
          nivelAlarma={1.7}
          nivelMax={4}
        />
      </div>

      <div style={{ gridColumn: "span 2", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Cerro"
          chartLabel="Nivel del Estanque (m)"
          divisor={100}
          data={nivelChartDataP2}
          nivelAlarma={1.7}
        />
      </div>

      {/* Horómetros */}
      <div style={{ gridColumn: "span 3", gridRow: "3" }}>
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario Pozo"
          chartLabel="Horómetro"
          data={horometroChartDataP1}
        />
      </div>

      <div style={{ gridColumn: "span 3", gridRow: "3" }}>
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario Cerro"
          chartLabel="Horómetro"
          data={horometroChartDataP2}
        />
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
          <Navbar text={data?.snapshot.P1.nivel.time}>
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
