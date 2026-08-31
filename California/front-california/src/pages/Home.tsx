import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import States from "../components/States";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import GraphCard from "../components/GraphCard";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import Error from "./Error";
import logoJte from "../assets/logoJte.png";

import { fetchWithCache } from "../components/fetchWithcache";

interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado_1: number;
  tiempo_vaciado_1_formatted: string;
  tiempo_vaciado_2: number;
  tiempo_vaciado_2_formatted: string;
}

interface Datos {
  NIVEL_CERRO?: Metric;
  NIVEL_METALICO?: Metric;
  PRESION?: Metric;
  TELEMETRIA?: Metric;
  MANUAL?: Metric;
  TOTALIZADOR?: Metric;
  FREATICO?: Metric;
  BOMBA?: Metric;
  CAUDAL?: Metric;
}

interface Metric {
  value: number;
  time: string;
}

const emptyMetric = (): Metric => ({ value: 0, time: "" });

function normalizeSnapshot(raw: any): Snapshot {
  const snap = raw?.snapshot ?? {};
  return {
    tiempo_vaciado_1: raw?.tiempo_vaciado_1 ?? 0,
    tiempo_vaciado_1_formatted: raw?.tiempo_vaciado_1_formatted ?? "--",
    tiempo_vaciado_2: raw?.tiempo_vaciado_2 ?? 0,
    tiempo_vaciado_2_formatted: raw?.tiempo_vaciado_2_formatted ?? "--",
    snapshot: {
      NIVEL_CERRO: snap.NIVEL_CERRO ?? emptyMetric(),
      NIVEL_METALICO: snap.NIVEL_METALICO ?? emptyMetric(),
      PRESION: snap.PRESION ?? emptyMetric(),
      TELEMETRIA: snap.TELEMETRIA ?? emptyMetric(),
      MANUAL: snap.MANUAL ?? emptyMetric(),
      TOTALIZADOR: snap.TOTALIZADOR ?? emptyMetric(),
      FREATICO: snap.FREATICO ?? emptyMetric(),
      BOMBA: snap.BOMBA ?? emptyMetric(),
      CAUDAL: snap.CAUDAL ?? emptyMetric(),
    },
  };
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);

  const [nivelChartData, setNivelData] = useState<Metric[]>([]);
  const [nivel2ChartData, setNivel2Data] = useState<Metric[]>([]);
  const [caudalChartData, setCaudalData] = useState<Metric[]>([]);
  const [totalizadorChartData, setTotalizadorData] = useState<Metric[]>([]);
  const [horometroChartData, setHorometroData] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenEstanque2, setIsOpenEstanque2] = useState(isLargeScreen);
  const [isOpenBomba, setIsOpenBomba] = useState(isLargeScreen);

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

    // Fetch Data
    const fetchData = async () => {
      // Fetch snapshot (requerido para renderizar)
      try {
        const snapshotRes = await fetch(
          "https://app.jteanalytics.cl/california/snapshot",
        );
        if (snapshotRes.ok) {
          const raw = await snapshotRes.json();
          setData(normalizeSnapshot(raw));
        }
      } catch (error) {
        console.error("Error al obtener snapshot:", error);
      } finally {
        setLoading(false);
      }

      // Fetch series de forma independiente (un fallo no bloquea los demás)
      const safeFetch = async (url: string): Promise<Metric[]> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return [];
          const json = await res.json();
          return Array.isArray(json) ? json : [];
        } catch {
          return [];
        }
      };

      const [metalicoData, cerroData, caudalData, totData, horData] =
        await Promise.all([
          safeFetch(
            "https://app.jteanalytics.cl/california/metalico?limit=300",
          ),
          safeFetch("https://app.jteanalytics.cl/california/cerro?limit=300"),
          safeFetch("https://app.jteanalytics.cl/california/caudal?limit=300"),
          fetchWithCache("totalizador", end).catch(() => [] as Metric[]),
          fetchWithCache("horometro", end).catch(() => [] as Metric[]),
        ]);

      setNivelData(metalicoData);
      setNivel2Data(cerroData);
      setCaudalData(caudalData);
      setTotalizadorData(totData);
      setHorometroData(horData);
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
  const VistaMovil = () => (
    <>
      {/* Estanque 1 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque Cerro 100 m³"
            text1={[
              "Nivel",
              `${(data.snapshot.NIVEL_CERRO?.value ?? 0).toFixed(2)} %`,
            ]}
            text2={[
              "Volumen Actual",
              `${(data.snapshot.NIVEL_CERRO?.value ?? 0).toFixed(2)} m³`,
            ]}
            text3={["Tiempo Vaciado", data.tiempo_vaciado_1_formatted]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.NIVEL_CERRO?.value ?? 0}
            nivelMaximo={100}
          />
          <ToggleCardButton
            isOpen={isOpenEstanque}
            onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
          />
        </Card>
        <GraphCard
          isOpen={isOpenEstanque}
          title="Estanque Cerro 100 m³"
          chartLabel="Nivel del Estanque (%)"
          initialData={nivelChartData}
          type="nivel"
          nivelMax={100}
          nivelAlarma={50}
          fetchEndpoint="https://app.jteanalytics.cl/california/cerro"
        />
      </div>
      {/* Estanque 2 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque Metalico 40 m³"
            text1={[
              "Nivel",
              `${(data.snapshot.NIVEL_METALICO?.value ?? 0).toFixed(2)} %`,
            ]}
            text2={[
              "Volumen Actual",
              `${(
                (40 / 100) *
                (data.snapshot.NIVEL_METALICO?.value ?? 0)
              ).toFixed(2)} m³`,
            ]}
            text3={["Tiempo Vaciado", data.tiempo_vaciado_2_formatted]}
            date={data.snapshot.NIVEL_METALICO?.time}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.NIVEL_METALICO?.value ?? 0}
            nivelMaximo={100}
          />
          <ToggleCardButton
            isOpen={isOpenEstanque2}
            onToggle={() => setIsOpenEstanque2(!isOpenEstanque2)}
          />
        </Card>
        <GraphCard
          isOpen={isOpenEstanque2}
          title="Estanque Metálico"
          chartLabel="Nivel del Estanque (%)"
          initialData={nivel2ChartData}
          type="nivel"
          nivelMax={100}
          nivelAlarma={30}
          fetchEndpoint="https://app.jteanalytics.cl/california/metalico"
        />
      </div>
      {/* Bomba */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Bomba"
            text1={[
              "Caudal Impulsión",
              `${(data.snapshot.CAUDAL?.value ?? 0).toFixed(2)} l/s`,
            ]}
            text2={[
              "Nivel Freático",
              `${((data.snapshot.FREATICO?.value ?? 0) / 100).toFixed(2)} m`,
            ]}
            text3={["Horómetro", minutesToHHMM(ultimoHorometro)]}
            text4={["Totalizador", `${(ultimoTotalizador / 10).toFixed(2)} m³`]}
            text5={[
              "Totalizador",
              `${((data.snapshot.TOTALIZADOR?.value ?? 0) / 10).toFixed(2)} m³`,
            ]}
            text6={[
              "Presión",
              `${(data.snapshot.PRESION?.value ?? 0).toFixed(2)} psi`,
            ]}
          />
          <ToggleCardButton
            isOpen={isOpenBomba}
            onToggle={() => setIsOpenBomba(!isOpenBomba)}
          />
        </Card>
        <GraphCard
          isOpen={isOpenBomba}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          initialData={caudalChartData}
          type="caudal"
          nivelMax={15}
          fetchEndpoint="https://app.jteanalytics.cl/california/caudal"
        />
        <GraphCard
          isOpen={isOpenBomba}
          title="Horómetro Diario"
          chartLabel="Horómetro"
          initialData={horometroChartData}
          type="horometro"
        />
        <GraphCard
          isOpen={isOpenBomba}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          initialData={totalizadorChartData}
          divisor={10}
          type="totalizador"
        />
        {/* Panel de Estados */}
        <States
          automatico={(data.snapshot.TELEMETRIA?.value ?? 0).toString()}
          bomba={(data.snapshot.BOMBA?.value ?? 0).toString()}
          manual={(data.snapshot.MANUAL?.value ?? 0).toString()}
        />
      </div>
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
        gridTemplateRows: "auto auto 1fr",
        gap: "1rem",
        width: "100%",
        maxWidth: "2400px",
        margin: "0 auto",
        minHeight: "calc(100vh - 100px)",
      }}
    >
      {/* Diagrama SCADA (ocupa 0,0; 0,1; 1,0; 1,1) */}
      <div style={{ gridColumn: "1 / span 2", gridRow: "1 / span 2" }}>
        <div className="card w-100 p-4 justify-content-center">
          <ScadaDiagram
            data={data}
            hor={ultimoHorometro}
            tot={ultimoTotalizador}
          />
        </div>
      </div>

      {/* Horómetro (0,2) */}
      <div style={{ gridColumn: "1", gridRow: "3" }}>
        <GraphCard
          isOpen={true}
          title="Horómetro Diario"
          chartLabel="Horómetro"
          initialData={horometroChartData}
          type="horometro"
        />
      </div>

      {/* Totalizador (1,2) */}
      <div style={{ gridColumn: "2", gridRow: "3" }}>
        <GraphCard
          isOpen={true}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          initialData={totalizadorChartData}
          divisor={10}
          type="totalizador"
        />
      </div>

      {/* Estanque 1 (2,0) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <GraphCard
          isOpen={true}
          title="Estanque Hormigón"
          chartLabel="Nivel del Estanque (m)"
          initialData={nivelChartData}
          type="nivel"
          nivelMax={100}
          nivelAlarma={50}
          fetchEndpoint="https://app.jteanalytics.cl/california/cerro"
        />
      </div>

      {/* Estanque 2 (2,1) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <GraphCard
          isOpen={true}
          title="Estanque Metálico"
          chartLabel="Nivel del Estanque (m)"
          initialData={nivel2ChartData}
          type="nivel"
          nivelMax={100}
          nivelAlarma={30}
          fetchEndpoint="https://app.jteanalytics.cl/california/metalico"
        />
      </div>

      {/* Caudal (2,2) */}
      <div style={{ gridColumn: "3", gridRow: "3" }}>
        <GraphCard
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          initialData={caudalChartData}
          type="caudal"
          nivelMax={20}
          fetchEndpoint="https://app.jteanalytics.cl/california/caudal"
        />
      </div>
    </div>
  );

  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar text={data.snapshot.CAUDAL?.time ?? ""}>
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
