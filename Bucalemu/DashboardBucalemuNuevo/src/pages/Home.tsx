import Card, { CardBody } from "../components/Card";
import { useEffect, useState, memo } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import GraphCard from "../components/GraphCard";
import Error from "./Error";
import DropdownCardv3 from "../components/DropDownCardv3";
import ScadaDiagram from "../components/ScadaDiagram";
import logoJte from "../assets/logoJte.png";
import State from "../components/StatesV2";
import { fetchWithCache } from "../components/fetchWithcache";

interface Metric {
  time: string;
  value: number;
}

interface Datos {
  ssr_bucalemu_bajo_nivel: Metric;
  ssr_bucalemu_bajo_temperatura: Metric;
  ssr_nilahue_nivel: Metric;
  ssr_nilahue_bomba: Metric;
  ssr_casuto_nivel: Metric;
  ssr_casuto_bateria: Metric;
  ssr_bucalemu_alto_nivel: Metric;
  ssr_nilahue_caudal: Metric;
  ssr_nilahue_totalizador: Metric;
  "BBAJO_NUEVO--slave.automatico": Metric;
  "BBAJO_NUEVO--slave.bomba": Metric;
  "BBAJO_NUEVO--slave.falla": Metric;
  "BBAJO_NUEVO--slave.manual": Metric;
  "BBAJO_NUEVO--slave.nivel_balto": Metric;
  "BBAJO_NUEVO--slave.REGF828": Metric;
}

interface DatosVaciado {
  t_vaciado_bucalemu_alto_nivel: string;
  t_vaciado_bucalemu_bajo_nivel: string;
  t_vaciado_nilahue_nivel: string;
  t_vaciado_casuto_nivel: string;
}

interface ChartData {
  ssr_bucalemu_alto_nivel: ChartPoint[];
  ssr_bucalemu_bajo_nivel: ChartPoint[];
  ssr_nilahue_nivel: ChartPoint[];
  ssr_casuto_nivel: ChartPoint[];
}

interface ChartPoint {
  mt_value: number;
  mt_time_2: string;
}

// ── Mapeo de datos de chart ──────────────────────────────────────────
const mapToMetrics = (data: any[] | undefined | null): Metric[] => {
  if (!data) return [];
  return data.map((d) => {
    if ("mt_value" in d) {
      return { value: d.mt_value, time: d.mt_time_2 };
    }
    return d as Metric;
  });
};

// ── Skeleton de carga para gráficos individuales ─────────────────────
const GraphSkeleton = () => (
  <div
    className="card mt-2 mb-2"
    style={{
      height: "230px",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f8f9fa",
    }}
  >
    <div className="d-flex flex-column align-items-center gap-2">
      <div
        className="spinner-border spinner-border-sm text-primary"
        role="status"
      >
        <span className="visually-hidden">Cargando gráfico...</span>
      </div>
      <span className="text-muted small">Cargando gráfico...</span>
    </div>
  </div>
);

// =====================
// VISTA MÓVIL (extraída como componente con memo)
// =====================
interface VistaMovilProps {
  data: Datos;
  vData: DatosVaciado | null;
  chartData: ChartData | null;
  caudal: Metric[] | null;
  totalizador: Metric[] | null;
  chartsReady: boolean;
}

const VistaMovil = memo(function VistaMovil({
  data,
  vData,
  chartData,
  caudal,
  totalizador,
  chartsReady,
}: VistaMovilProps) {
  const [isOpenAlto, setIsOpenAlto] = useState(false);
  const [isOpenBajo, setIsOpenBajo] = useState(false);
  const [isOpenNilahue, setIsOpenNilahue] = useState(false);
  const [isOpenCasuto, setIsOpenCasuto] = useState(false);
  const [isOpenBomba, setIsOpenBomba] = useState(false);

  let ultimoTotalizador = 0;
  if (totalizador) {
    ultimoTotalizador =
      totalizador?.length > 0 ? totalizador[totalizador.length - 1].value : 0;
  }

  return (
    <>
      {/* Nilahue */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            date={data.ssr_nilahue_nivel.time}
            title="Nilahue"
            text1={["Nivel", `${data.ssr_nilahue_nivel.value.toFixed(2)} m`]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.ssr_nilahue_nivel.value).toFixed(2)} m³`,
            ]}
            text3={[
              "T. Vaciado",
              `${
                vData?.t_vaciado_nilahue_nivel == "0s"
                  ? "Llenando..."
                  : vData?.t_vaciado_nilahue_nivel
              }`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.ssr_nilahue_nivel.value}
            nivelMaximo={4.25}
          />
          <ToggleCardButton
            isOpen={isOpenNilahue}
            onToggle={() => setIsOpenNilahue(!isOpenNilahue)}
          />
        </Card>
        <div className="mb-4">
          {chartsReady ? (
            <GraphCard
              isOpen={isOpenNilahue}
              title="Nilahue"
              chartLabel="Nivel del Nilahue (m)"
              initialData={mapToMetrics(chartData?.ssr_nilahue_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_nilahue"
              nivelAlarma={1}
              nivelMax={5}
            />
          ) : (
            isOpenNilahue && <GraphSkeleton />
          )}
        </div>
      </div>

      {/* Casuto */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            date={data.ssr_casuto_nivel.time}
            title="Casuto"
            text1={["Nivel", `${data.ssr_casuto_nivel.value.toFixed(2)} m`]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.ssr_casuto_nivel.value).toFixed(2)} m³`,
            ]}
            text3={[
              "T. Vaciado",
              `${
                vData?.t_vaciado_casuto_nivel == "0s"
                  ? "Llenando..."
                  : vData?.t_vaciado_casuto_nivel
              }`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.ssr_casuto_nivel.value}
            nivelMaximo={4.25}
          />
          <ToggleCardButton
            isOpen={isOpenCasuto}
            onToggle={() => setIsOpenCasuto(!isOpenCasuto)}
          />
        </Card>
        <div className="mb-4">
          {chartsReady ? (
            <GraphCard
              isOpen={isOpenCasuto}
              title="Casuto"
              chartLabel="Nivel del Casuto (m)"
              initialData={mapToMetrics(chartData?.ssr_casuto_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_casuto"
              nivelAlarma={2}
              nivelMax={5}
            />
          ) : (
            isOpenCasuto && <GraphSkeleton />
          )}
        </div>
      </div>
      {/* Bucalemu Bajo */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            date={data.ssr_bucalemu_bajo_nivel.time}
            title="Bucalemu Bajo"
            text1={[
              "Nivel",
              `${data.ssr_bucalemu_bajo_nivel.value.toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.ssr_bucalemu_bajo_nivel.value).toFixed(2)} m³`,
            ]}
            text3={[
              "T. Vaciado",
              `${
                vData?.t_vaciado_bucalemu_bajo_nivel == "0s"
                  ? "Llenando..."
                  : vData?.t_vaciado_bucalemu_bajo_nivel
              }`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data.ssr_bucalemu_bajo_nivel.value}
            nivelMaximo={4.25}
          />
          <ToggleCardButton
            isOpen={isOpenBajo}
            onToggle={() => setIsOpenBajo(!isOpenBajo)}
          />
        </Card>
        <div className="mb-4">
          {chartsReady ? (
            <GraphCard
              isOpen={isOpenBajo}
              title="Bucalemu Bajo"
              chartLabel="Nivel del Bucalemu Bajo (m)"
              initialData={mapToMetrics(chartData?.ssr_bucalemu_bajo_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_bucalemu_bajo"
              nivelAlarma={1}
              nivelMax={5}
            />
          ) : (
            isOpenBajo && <GraphSkeleton />
          )}
        </div>
      </div>
      {/* Bucalemu Alto */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            date={data["BBAJO_NUEVO--slave.nivel_balto"]?.time}
            title="Bucalemu Alto"
            text1={[
              "Nivel",
              `${data["BBAJO_NUEVO--slave.nivel_balto"]?.value?.toFixed(2) ?? "--"} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * (data["BBAJO_NUEVO--slave.nivel_balto"]?.value ?? 0)).toFixed(2)} m³`,
            ]}
            text3={[
              "T. Vaciado",
              `${
                vData?.t_vaciado_bucalemu_alto_nivel == "0s"
                  ? "Llenando..."
                  : vData?.t_vaciado_bucalemu_alto_nivel
              }`,
            ]}
          />
          <TankLevelCircular
            nivelActual={data["BBAJO_NUEVO--slave.nivel_balto"]?.value ?? 0}
            nivelMaximo={4.25}
          />
          <ToggleCardButton
            isOpen={isOpenAlto}
            onToggle={() => setIsOpenAlto(!isOpenAlto)}
          />
        </Card>
        <div className="mb-4">
          {chartsReady ? (
            <GraphCard
              isOpen={isOpenAlto}
              title="Bucalemu Alto"
              chartLabel="Nivel del Bucalemu Alto (m)"
              initialData={mapToMetrics(chartData?.ssr_bucalemu_alto_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_bucalemu_alto"
              nivelAlarma={1}
              nivelMax={5}
            />
          ) : (
            isOpenAlto && <GraphSkeleton />
          )}
        </div>
      </div>

      {/* Estado Bucalemu Bajo Nuevo */}
      <div className="col-12 mb-1">
        <State
          title="Estado Tablero Bucalemu Bajo"
          automatico={data["BBAJO_NUEVO--slave.automatico"]?.value.toString()}
          bomba={data["BBAJO_NUEVO--slave.bomba"]?.value.toString()}
          falla={data["BBAJO_NUEVO--slave.falla"]?.value.toString()}
          manual={data["BBAJO_NUEVO--slave.manual"]?.value.toString()}
        />
      </div>

      {/* Bomba */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            title="Bomba"
            text1={[
              "Caudal Impulsión",
              `${data.ssr_nilahue_caudal.value.toFixed(2)} l/s`,
            ]}
            text5={["Totalizador Diario", `${ultimoTotalizador.toFixed(2)} m³`]}
            text6={[
              "Totalizador Total",
              `${data.ssr_nilahue_totalizador.value.toFixed(2)} m³`,
            ]}
          />
          <ToggleCardButton
            isOpen={isOpenBomba}
            onToggle={() => setIsOpenBomba(!isOpenBomba)}
          />
        </Card>
        <div>
          {chartsReady ? (
            <GraphCard
              isOpen={isOpenBomba}
              title="Caudal"
              chartLabel="Caudal de Impulsión (l/s)"
              initialData={mapToMetrics(caudal)}
              type="caudal"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/caudal"
              nivelMax={30}
            />
          ) : (
            isOpenBomba && <GraphSkeleton />
          )}
        </div>
        <div className="my-2">
          {chartsReady ? (
            <DropdownCardv3
              isOpen={isOpenBomba}
              title="Totalizador Diario"
              chartLabel="Totalizador en m³"
              data={totalizador || []}
            />
          ) : (
            isOpenBomba && <GraphSkeleton />
          )}
        </div>
      </div>
    </>
  );
});

// =====================
// VISTA DESKTOP (extraída como componente con memo)
// =====================
interface VistaDesktopProps {
  data: Datos;
  vData: DatosVaciado | null;
  chartData: ChartData | null;
  caudal: Metric[] | null;
  totalizador: Metric[] | null;
  chartsReady: boolean;
}

const VistaDesktop = memo(function VistaDesktop({
  data,
  vData,
  chartData,
  caudal,
  totalizador,
  chartsReady,
}: VistaDesktopProps) {
  return (
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
          <ScadaDiagram data={data} vaciado={vData} />
        </div>
      </div>

      {/* Estado Bucalemu Bajo Nuevo (Col 3, Row 3) */}
      <div style={{ gridColumn: "3", gridRow: "3" }}></div>

      {/* Nivel Estanque (Col 3, Row 1) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        {chartsReady ? (
          <DropdownCardv3
            isOpen={true}
            title="Totalizador Diario"
            chartLabel="Totalizador en m³"
            data={totalizador || []}
          />
        ) : (
          <GraphSkeleton />
        )}
      </div>

      {/* Caudal (Col 3, Row 2) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        {chartsReady ? (
          <GraphCard
            isOpen={true}
            title="Caudal"
            chartLabel="Caudal de Impulsión (l/s)"
            initialData={mapToMetrics(caudal)}
            type="caudal"
            fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/caudal"
            nivelMax={30}
          />
        ) : (
          <GraphSkeleton />
        )}
      </div>

      {/* Fila Inferior Compartida (Horómetro y Totalizador) */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "4",
          display: "flex",
          gap: "1rem",
        }}
      >
        <div style={{ flex: 1 }}>
          {chartsReady ? (
            <GraphCard
              isOpen={true}
              title="Nilahue"
              chartLabel="Nivel del Nilahue (m)"
              initialData={mapToMetrics(chartData?.ssr_nilahue_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_nilahue"
              nivelMax={5}
              nivelAlarma={1}
            />
          ) : (
            <GraphSkeleton />
          )}
        </div>
        <div style={{ flex: 1 }}>
          {chartsReady ? (
            <GraphCard
              isOpen={true}
              title="Casuto"
              chartLabel="Nivel del Casuto (m)"
              initialData={mapToMetrics(chartData?.ssr_casuto_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_casuto"
              nivelMax={5}
              nivelAlarma={2}
            />
          ) : (
            <GraphSkeleton />
          )}
        </div>
        <div style={{ flex: 1 }}>
          {chartsReady ? (
            <GraphCard
              isOpen={true}
              title="Bucalemu Bajo"
              chartLabel="Nivel del Bucalemu Bajo (m)"
              initialData={mapToMetrics(chartData?.ssr_bucalemu_bajo_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_bucalemu_bajo"
              nivelMax={5}
              nivelAlarma={1}
            />
          ) : (
            <GraphSkeleton />
          )}
        </div>
        <div style={{ flex: 1 }}>
          {chartsReady ? (
            <GraphCard
              isOpen={true}
              title="Bucalemu Alto"
              chartLabel="Nivel del Bucalemu Alto (m)"
              initialData={mapToMetrics(chartData?.ssr_bucalemu_alto_nivel)}
              type="nivel"
              fetchEndpoint="https://app.jteanalytics.cl/bucalemu/metrics/nivel_bucalemu_alto"
              nivelMax={5}
              nivelAlarma={2}
            />
          ) : (
            <GraphSkeleton />
          )}
        </div>
      </div>
    </div>
  );
});

// =====================
// COMPONENTE PRINCIPAL
// =====================
function App() {
  // Fase 1: Datos críticos (snapshot) — lo mínimo para mostrar algo al usuario
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [vData, setVaciadoData] = useState<DatosVaciado | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [caudal, setCaudal] = useState<Metric[] | null>(null);

  // Fase 2: Datos secundarios (gráficos) — se cargan después
  const [chartsReady, setChartsReady] = useState(false);
  const [totalizador, setTotalizador] = useState<Metric[] | null>(null);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1500);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
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
        // ── Fase 1: Snapshot consolidado (1 sola llamada HTTP) ──────
        // Devuelve latest + levels + emptying + caudal en paralelo del lado del servidor
        const snapshotRes = await fetch(
          "https://app.jteanalytics.cl/bucalemu/metrics/snapshot",
        );
        const snapshot = await snapshotRes.json();

        // Setear datos críticos → la UI se muestra inmediatamente
        setData(snapshot.latest as Datos);
        setVaciadoData(snapshot.emptying as DatosVaciado);
        setChartData(snapshot.levels as ChartData);
        setCaudal(snapshot.caudal as Metric[]);
        setSnapshotLoading(false); // ← El usuario ya ve los tanques, SCADA y estados

        // ── Fase 2: Datos secundarios (totalizador con caché local) ──
        const totalizadorData = await fetchWithCache("totalizador", end);
        setTotalizador(totalizadorData);
        setChartsReady(true); // ← Los gráficos ahora se renderizan
      } catch (error) {
        console.error("Error al cargar datos:", error);
        setSnapshotLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 120000);
    return () => clearInterval(intervalId);
  }, []);

  if (snapshotLoading) return <Loading />;
  if (!data) return <Error />;

  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar />
        </div>

        <div className="flex-grow-1 w-100 d-flex flex-column align-items-center px-3">
          {isLargeScreen ? (
            <VistaDesktop
              data={data}
              vData={vData}
              chartData={chartData}
              caudal={caudal}
              totalizador={totalizador}
              chartsReady={chartsReady}
            />
          ) : (
            <div className="row w-100" style={{ maxWidth: "800px" }}>
              <VistaMovil
                data={data}
                vData={vData}
                chartData={chartData}
                caudal={caudal}
                totalizador={totalizador}
                chartsReady={chartsReady}
              />
            </div>
          )}
        </div>

        <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
          <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img src={logoJte} alt="logo" width={40} height={24} />
        </footer>
      </div>
    </>
  );
}

export default App;
