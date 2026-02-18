import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import DropdownCard from "../components/DropdownCard";
import Error from "./Error";
import DropdownCardv3 from "../components/DropDownCardv3";
import ScadaDiagram from "../components/ScadaDiagram";
import logoJte from "../assets/logoJte.png";

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

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [vData, setVaciadoData] = useState<DatosVaciado | null>(null);
  const [totalizador, setTotalizador] = useState<Metric[] | null>(null);

  const [isOpenAlto, setIsOpenAlto] = useState(false);
  const [isOpenBajo, setIsOpenBajo] = useState(false);
  const [isOpenNilahue, setIsOpenNilahue] = useState(false);
  const [isOpenCasuto, setIsOpenCasuto] = useState(false);
  const [isOpenBomba, setIsOpenBomba] = useState(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [caudal, setCaudal] = useState<Metric[] | null>(null);

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
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 15);
    const start = formatter.format(startDate);

    const fetchData = async () => {
      try {
        const [snapshotRes, totalizadorRes, nivelRes, caudalRes, vaciadoRes] =
          await Promise.all([
            fetch("https://app.jteanalytics.cl/bucalemu/metrics/latest"),
            fetch(
              `https://app.jteanalytics.cl/bucalemu/metrics/totalizador?start=${start}&end=${end}`,
            ),
            fetch(`https://app.jteanalytics.cl/bucalemu/metrics/all`),
            fetch(`https://app.jteanalytics.cl/bucalemu/metrics/caudal`),
            fetch(`https://app.jteanalytics.cl/bucalemu/metrics/emptying`),
          ]);

        const snapshotData: Datos = await snapshotRes.json();
        setData(snapshotData);

        setTotalizador(await totalizadorRes.json());
        setChartData(await nivelRes.json());
        setCaudal(await caudalRes.json());
        setVaciadoData(await vaciadoRes.json());
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

  let ultimoTotalizador = 0;
  if (totalizador) {
    ultimoTotalizador =
      totalizador?.length > 0 ? totalizador[totalizador.length - 1].value : 0;
  }

  // =====================
  // VISTA MÓVIL
  // =====================
  const VistaMovil = () => (
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
        <DropdownCard
          className="mb-4"
          isOpen={isOpenNilahue}
          title="Nilahue"
          chartLabel="Nivel del Nilahue (m)"
          data={chartData?.ssr_nilahue_nivel || []}
          nivelAlarma={1}
          nivelMax={5}
        />
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
        <DropdownCard
          className="mb-4"
          isOpen={isOpenCasuto}
          title="Casuto"
          chartLabel="Nivel del Casuto (m)"
          data={chartData?.ssr_casuto_nivel || []}
          nivelAlarma={2}
          nivelMax={5}
        />
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
        <DropdownCard
          className="mb-4"
          isOpen={isOpenBajo}
          title="Bucalemu Bajo"
          chartLabel="Nivel del Bucalemu Bajo (m)"
          data={chartData?.ssr_bucalemu_bajo_nivel || []}
          nivelAlarma={1}
          nivelMax={5}
        />
      </div>
      {/* Bucalemu Alto */}
      <div className="col-12 mb-1">
        <Card className="mb-2">
          <CardBody
            date={data.ssr_bucalemu_alto_nivel.time}
            title="Bucalemu Alto"
            text1={[
              "Nivel",
              `${data.ssr_bucalemu_alto_nivel.value.toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.ssr_bucalemu_alto_nivel.value).toFixed(2)} m³`,
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
            nivelActual={data.ssr_bucalemu_alto_nivel.value}
            nivelMaximo={4.25}
          />
          <ToggleCardButton
            isOpen={isOpenAlto}
            onToggle={() => setIsOpenAlto(!isOpenAlto)}
          />
        </Card>
        <DropdownCard
          className="mb-4"
          isOpen={isOpenAlto}
          title="Bucalemu Alto"
          chartLabel="Nivel del Bucalemu Alto (m)"
          data={chartData?.ssr_bucalemu_alto_nivel || []}
          nivelAlarma={1}
          nivelMax={5}
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
        <DropdownCard
          isOpen={isOpenBomba}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudal || []}
          nivelMax={30}
        />
        <div className="my-2">
          <DropdownCardv3
            isOpen={isOpenBomba}
            title="Totalizador Diario"
            chartLabel="Totalizador en m³"
            data={totalizador || []}
          />
        </div>
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
          <ScadaDiagram data={data} vaciado={vData} />
        </div>
      </div>

      {/* Nivel Estanque (Col 3, Row 1) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <DropdownCardv3
          isOpen={true}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizador || []}
        />
      </div>

      {/* Caudal (Col 3, Row 2) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudal || []}
          nivelMax={30}
        />
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
          <DropdownCard
            isOpen={true}
            title="Nilahue"
            chartLabel="Nivel del Nilahue (m)"
            data={chartData?.ssr_nilahue_nivel || []}
            nivelMax={5}
            nivelAlarma={1}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DropdownCard
            isOpen={true}
            title="Casuto"
            chartLabel="Nivel del Casuto (m)"
            data={chartData?.ssr_casuto_nivel || []}
            nivelMax={5}
            nivelAlarma={2}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DropdownCard
            isOpen={true}
            title="Bucalemu Bajo"
            chartLabel="Nivel del Bucalemu Bajo (m)"
            data={chartData?.ssr_bucalemu_bajo_nivel || []}
            nivelMax={5}
            nivelAlarma={1}
          />
        </div>
        <div style={{ flex: 1 }}>
          <DropdownCard
            isOpen={true}
            title="Bucalemu Alto"
            chartLabel="Nivel del Bucalemu Alto (m)"
            data={chartData?.ssr_bucalemu_alto_nivel || []}
            nivelMax={5}
            nivelAlarma={2}
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
          <Navbar />
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
    </>
  );
}

export default App;
