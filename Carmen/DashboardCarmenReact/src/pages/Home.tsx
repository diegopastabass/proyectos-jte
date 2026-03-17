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
  POZO: Pozo;
  SENTINA: Sentina;
}

interface Pozo {
  falla: Metric;
  freatico: Metric;
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  bomba: Metric;
}

interface Sentina {
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  solar: Metric; // Dividir entre 1000
  bomba: Metric;
  AI23: Metric;
}

interface Metric {
  value: number;
  time: string;
}

function App() {
  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);
  const [nivelChartDataPozo, setNivelChartDataPozo] = useState<Metric[]>([]);
  const [nivelChartDataSentina, setNivelChartDataSentina] = useState<Metric[]>(
    [],
  );
  const [horometroChartDataPozo, setHorometroChartDataPozo] = useState<
    Metric[]
  >([]);
  const [horometroChartDataSentina, setHorometroChartDataSentina] = useState<
    Metric[]
  >([]);

  // Estados de UI
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);
  const [isOpenEstanquePozo, setIsOpenEstanquePozo] = useState(true);
  const [isOpenEstanqueSentina, setIsOpenEstanqueSentina] = useState(true);

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
          horometroPozoRes,
          horometroSentinaRes,
          nivelPozoRes,
          nivelSentinaRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/carmen/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/carmen/horometro_bajo?start=${start}&end=${end}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/carmen/horometro_sentina?start=${start}&end=${end}`,
          ),
          fetch(`https://app.jteanalytics.cl/carmen/nivel_bajo`),
          fetch(`https://app.jteanalytics.cl/carmen/nivel_sentina`),
        ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setHorometroChartDataPozo(await horometroPozoRes.json());
        setHorometroChartDataSentina(await horometroSentinaRes.json());
        setNivelChartDataPozo(await nivelPozoRes.json());
        setNivelChartDataSentina(await nivelSentinaRes.json());
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
  const ultimoHorometroPozo =
    horometroChartDataPozo.length > 0
      ? horometroChartDataPozo[horometroChartDataPozo.length - 1].value
      : 0;

  const ultimoHorometroSentina =
    horometroChartDataSentina.length > 0
      ? horometroChartDataSentina[horometroChartDataSentina.length - 1].value
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
            text1={["Nivel", `${data.snapshot.POZO.nivel.value.toFixed(2)} m`]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.snapshot.POZO.nivel.value).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted_pozo]}
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroPozo)} h`]}
            text5={[
              "Freático",
              `${(data.snapshot.POZO.freatico.value / 100).toFixed(2)} m`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.POZO.nivel.value}
            nivelMaximo={3.4}
          />
          <ToggleCardButton
            isOpen={isOpenEstanquePozo}
            onToggle={() => setIsOpenEstanquePozo(!isOpenEstanquePozo)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanquePozo}
          title="Estanque Pozo"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataPozo}
          nivelAlarma={1.5}
          nivelMax={4}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenEstanquePozo}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometroChartDataPozo}
          />
        </div>
      </div>
      {/* Estados Pozo */}
      <div className="col-12 mb-4">
        <States
          title="Estado Tablero Pozo"
          automatico={data.snapshot.POZO.automatico.value.toString()}
          bomba={data.snapshot.POZO.bomba.value.toString()}
          falla={data.snapshot.POZO.falla.value.toString()}
        />
      </div>

      {/* Estanque Sentina*/}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque Cerro"
            text1={[
              "Nivel",
              `${(data.snapshot.SENTINA.nivel.value / 100).toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${(((60 / 7) * data.snapshot.SENTINA.nivel.value) / 100).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted_sentina]}
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroSentina)} h`]}
            text5={[
              "Solar",
              ` ${(data.snapshot.SENTINA.solar.value / 1000).toFixed(2)} V`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.SENTINA.nivel.value / 100}
            nivelMaximo={2.2}
          />
          <ToggleCardButton
            isOpen={isOpenEstanqueSentina}
            onToggle={() => setIsOpenEstanqueSentina(!isOpenEstanqueSentina)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenEstanqueSentina}
          title="Estanque Cerro"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataSentina}
          nivelAlarma={1}
          divisor={100}
        />
        <div className="my-2">
          <DropdownCardv2
            isOpen={isOpenEstanqueSentina}
            title="Horómetro Diario"
            chartLabel="Horómetro"
            data={horometroChartDataSentina}
          />
        </div>
      </div>
      {/* Estados Sentina */}
      <div className="col-12">
        <States
          title="Estado Tablero Sentina"
          automatico={data.snapshot.SENTINA.automatico.value.toString()}
          bomba={data.snapshot.SENTINA.bomba.value.toString()}
          presion={(data.snapshot.SENTINA.AI23.value / 100).toString()}
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
            horSen={ultimoHorometroSentina.toFixed(2)}
            horPoz={ultimoHorometroPozo.toFixed(2)}
          />
        </div>
      </div>

      {/* Niveles */}
      <div style={{ gridColumn: "span 2", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Pozo"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataPozo}
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
          data={nivelChartDataSentina}
          nivelAlarma={1.7}
        />
      </div>

      {/* Horómetros */}
      <div style={{ gridColumn: "span 3", gridRow: "3" }}>
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario Pozo"
          chartLabel="Horómetro"
          data={horometroChartDataPozo}
        />
      </div>

      <div style={{ gridColumn: "span 3", gridRow: "3" }}>
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario Cerro"
          chartLabel="Horómetro"
          data={horometroChartDataSentina}
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
          <Navbar text={data?.snapshot.POZO.nivel.time}>
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
