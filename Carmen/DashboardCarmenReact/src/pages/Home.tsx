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
  falla: Metric;
  freatico: Metric;
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
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroPozo)}`]}
            text5={[
              "Freático",
              `${data.snapshot.POZO.freatico.value.toFixed(2)} m`,
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
      <div className="col-12">
        <State>
          <StateBody
            automatico={data.snapshot.POZO.automatico.value.toString()}
            bomba={data.snapshot.POZO.bomba.value.toString()}
            falla={data.snapshot.POZO.falla.value.toString()}
          />
        </State>
      </div>

      {/* Estanque Sentina*/}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Estanque Sentina"
            text1={[
              "Nivel",
              `${data.snapshot.SENTINA.nivel.value.toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.snapshot.SENTINA.nivel.value).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vacío", data.tiempo_vaciado_formatted_sentina]}
            text4={["Horómetro", `${minutesToHHMM(ultimoHorometroSentina)}`]}
            text5={[
              "Freático",
              `${data.snapshot.SENTINA.freatico.value.toFixed(2)} m`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.SENTINA.nivel.value}
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
          title="Estanque Sentina"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartDataSentina}
          nivelAlarma={1}
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
        <State>
          <StateBody
            automatico={data.snapshot.SENTINA.automatico.value.toString()}
            bomba={data.snapshot.SENTINA.bomba.value.toString()}
            falla={data.snapshot.SENTINA.falla.value.toString()}
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
        gridTemplateRows: "1fr 1fr auto",
        gap: "1rem",
        width: "100%",
        maxWidth: "2400px",
        margin: "0 auto",
      }}
    >
      {/* Diagrama SCADA (Cubre cols 1-3, rows 1-2) */}
      <div style={{ gridColumn: "1 / 4", gridRow: "1 / 2" }}>
        <div className="card w-100 p-4 justify-content-center">
          <ScadaDiagram
            data={data}
            horSen={ultimoHorometroSentina.toFixed(2)}
            horPoz={ultimoHorometroPozo.toFixed(2)}
          />
        </div>
      </div>

      {/* Nivel Estanque (Col 3, Row 1) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque"
          chartLabel="Nivel del Estanque Pozo (m)"
          data={nivelChartDataPozo}
          nivelAlarma={1.7}
        />
      </div>

      {/* Nivel Estanque (Col 3, Row 2) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque"
          chartLabel="Nivel del Estanque Sentina (m)"
          data={nivelChartDataSentina}
          nivelAlarma={1.7}
        />
      </div>

      {/* Fila Inferior Compartida (Horómetro y Totalizador) */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "3",
          display: "flex",
          gap: "1rem",
        }}
      >
        <div style={{ flex: 1 }}>
          <DropdownCardv2
            isOpen={true}
            title="Horómetro Diario Pozo"
            chartLabel="Horómetro"
            data={horometroChartDataPozo}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DropdownCardv3
            isOpen={true}
            title="Horómetro Diario Sentina"
            chartLabel="Horómetro"
            data={horometroChartDataSentina}
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
