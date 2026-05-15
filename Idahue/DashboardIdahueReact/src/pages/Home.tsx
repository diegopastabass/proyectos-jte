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
  tiempo_vaciado_p1: number;
  tiempo_vaciado_formatted_p1: string;
  tiempo_vaciado_p2: number;
  tiempo_vaciado_formatted_p2: string;
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
  solar: Metric;
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
    [],
  );

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
            `https://app.jteanalytics.cl/idahue/horometro_planta1?start=${start}&end=${end}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/idahue/horometro_planta2?start=${start}&end=${end}`,
          ),
          fetch(`https://app.jteanalytics.cl/idahue/nivel_planta1`),
          fetch(`https://app.jteanalytics.cl/idahue/nivel_planta2`),
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

  const lastUpdateP1 = [
    data.snapshot.P1.automatico.time,
    data.snapshot.P1.horometro.time,
    data.snapshot.P1.nivel.time,
    data.snapshot.P1.bomba.time,
  ].reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  const lastUpdateP2 = [
    data.snapshot.P2.automatico.time,
    data.snapshot.P2.horometro.time,
    data.snapshot.P2.nivel.time,
    data.snapshot.P2.bomba.time,
  ].reduce((a, b) => (new Date(a) > new Date(b) ? a : b));

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
      {/* Estanque Planta 1*/}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque Planta 1"
            text1={[
              "Nivel",
              `${(data.snapshot.P1.nivel.value / 100).toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * (data.snapshot.P1.nivel.value / 100)).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted_p1]}
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroP1)} h`]}
            date={lastUpdateP1}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.P1.nivel.value / 100}
            nivelMaximo={3.1}
          />
          <ToggleCardButton
            isOpen={isOpenEstanqueP1}
            onToggle={() => setIsOpenEstanqueP1(!isOpenEstanqueP1)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanqueP1}
          title="Estanque Planta 1"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataP1}
          nivelAlarma={1.5}
          nivelMax={5}
          divisor={100}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenEstanqueP1}
            title="Horómetro Diario Planta 1"
            chartLabel="Horómetro"
            data={horometroChartDataP1}
          />
        </div>
      </div>
      {/* Estados Planta 1 */}
      <div className="col-12 mb-4">
        <States
          title="Estado Tablero Planta 1"
          automatico={data.snapshot.P1.automatico.value.toString()}
          bomba={data.snapshot.P1.bomba.value.toString()}
        />
      </div>

      {/* Estanque Planta 2*/}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque Planta 2"
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
            date={lastUpdateP2}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.P2.nivel.value / 100}
            nivelMaximo={4.1}
          />
          <ToggleCardButton
            isOpen={isOpenEstanqueP2}
            onToggle={() => setIsOpenEstanqueP2(!isOpenEstanqueP2)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanqueP2}
          title="Estanque Planta 2"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataP2}
          nivelAlarma={2}
          nivelMax={5}
          divisor={100}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenEstanqueP2}
            title="Horómetro Diario Planta 2"
            chartLabel="Horómetro"
            data={horometroChartDataP2}
          />
        </div>
      </div>

      {/* Estados Planta 2 */}
      <div className="col-12">
        <States
          title="Estado Tablero Planta 2"
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
        gridTemplateColumns: "1fr 1fr",
        gap: "2rem",
        width: "100%",
        maxWidth: "2400px",
        margin: "0 auto",
      }}
    >
      {/* Planta 1 */}
      <div className="d-flex flex-column gap-3">
        <div
          className="card w-100 p-4 justify-content-center"
          style={{ minHeight: "650px" }}
        >
          <ScadaDiagram
            horometro={data.snapshot.P1.horometro.value}
            horometro_diario={ultimoHorometroP1}
            name="Planta 1"
            tiempo_vaciado_formatted={data.tiempo_vaciado_formatted_p1}
            automatico={data.snapshot.P1.automatico}
            nivel={data.snapshot.P1.nivel}
            bomba={data.snapshot.P1.bomba}
            nivel_max={3.1}
            divisor_nivel={100}
            date={lastUpdateP1}
          />
        </div>
        <DropdownCard
          isOpen={true}
          title="Estanque Planta 1"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataP1}
          nivelAlarma={1.5}
          nivelMax={5}
          divisor={100}
        />
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario Planta 1"
          chartLabel="Horómetro"
          data={horometroChartDataP1}
        />
      </div>

      {/* Planta 2 */}
      <div className="d-flex flex-column gap-3">
        <div
          className="card w-100 p-4 justify-content-center"
          style={{ minHeight: "650px" }}
        >
          <ScadaDiagram
            horometro={data.snapshot.P2.horometro.value}
            horometro_diario={ultimoHorometroP2}
            name="Planta 2"
            tiempo_vaciado_formatted={data.tiempo_vaciado_formatted_p2}
            automatico={data.snapshot.P2.automatico}
            nivel={data.snapshot.P2.nivel}
            solar={data.snapshot.P2.solar.value / 1000}
            bomba={data.snapshot.P2.bomba}
            divisor_nivel={100}
            nivel_max={4.1}
            date={lastUpdateP2}
          />
        </div>
        <DropdownCard
          isOpen={true}
          title="Estanque Planta 2"
          chartLabel="Nivel del Estanque (m)"
          divisor={100}
          data={nivelChartDataP2}
          nivelAlarma={2}
          nivelMax={5}
        />
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario Planta 2"
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
          <Navbar text={lastUpdateP1}>
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
