import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import States from "../components/States";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggelCardButton";
import DropdownCard from "../components/DropdownCard";
import DropdownCardv2 from "../components/DropDownCardv2";
import DropdownCardv3 from "../components/DropDownCardv3";
import ScadaDiagram from "../components/ScadaDiagram";
import ExportModal from "../components/ExportModal";
import Error from "./Error";
import logoJte from "../assets/logoJte.png";
import DropdownCardv4 from "../components/DropdownCardv4";

interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado_hormigon: number;
  tiempo_vaciado_hormigon_formatted: string;
  tiempo_vaciado_metalico: number;
  tiempo_vaciado_metalico_formatted: string;
}

interface Datos {
  automatico: Metric;
  bomba: Metric;
  caudal: Metric;
  estanque_hormigon: Metric;
  estanque_metalico: Metric;
  falla: Metric;
  freatico_pozo: Metric;
  freatico_sentina: Metric;
  horometro: Metric;
  totalizador: Metric;
  i1: Metric;
  i2: Metric;
  i3: Metric;
  v1: Metric;
  v2: Metric;
  v3: Metric;
  kwh: Metric;
}

interface Metric {
  value: number;
  time: string;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Snapshot | null>(null);

  const [nivelChartData, setNivelData] = useState<Metric[]>([]);
  const [nivel2ChartData, setNivel2Data] = useState<Metric[]>([]);
  const [caudalChartData, setCaudalData] = useState<Metric[]>([]);
  const [totalizadorChartData, setTotalizadorData] = useState<Metric[]>([]);
  const [horometroChartData, setHorometroData] = useState<Metric[]>([]);
  const [kwhChartData, setKwhData] = useState<Metric[]>([]);
  const [voltajeChartData, setVoltajeData] = useState<{
    v1: Metric[];
  }>({
    v1: [],
  });
  const [corrienteChartData, setCorrienteData] = useState<{
    i1: Metric[];
  }>({
    i1: [],
  });

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
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 15);
    const start = formatter.format(startDate);

    const fetchData = async () => {
      try {
        const [
          snapshotRes,
          totalizadorRes,
          horometroRes,
          nivelRes,
          nivel2Res,
          caudalRes,
          kwhRes,
          voltajeRes,
          corrienteRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/quillay/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/quillay/totalizador?start=${start}&end=${end}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/quillay/horometro?start=${start}&end=${end}`,
          ),
          fetch(`https://app.jteanalytics.cl/quillay/nivel`),
          fetch(`https://app.jteanalytics.cl/quillay/nivel2`),
          fetch(`https://app.jteanalytics.cl/quillay/caudal`),
          fetch(
            `https://app.jteanalytics.cl/quillay/kwh?start=${start}&end=${end}`,
          ),
          fetch(`https://app.jteanalytics.cl/quillay/voltaje`),
          fetch(`https://app.jteanalytics.cl/quillay/corriente`),
        ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setTotalizadorData(await totalizadorRes.json());
        setHorometroData(await horometroRes.json());
        setNivelData(await nivelRes.json());
        setNivel2Data(await nivel2Res.json());
        setCaudalData(await caudalRes.json());
        setKwhData(await kwhRes.json());
        setVoltajeData(await voltajeRes.json());
        setCorrienteData(await corrienteRes.json());
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
  const VistaMovil = () => (
    <>
      {/* Estanque 1 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque Hormigón"
            text1={[
              "Nivel",
              `${data.snapshot.estanque_hormigon.value.toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.snapshot.estanque_hormigon.value).toFixed(
                2,
              )} m³`,
            ]}
            text3={["Tiempo Vaciado", data.tiempo_vaciado_hormigon_formatted]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.estanque_hormigon.value}
            nivelMaximo={3.5}
          />
          <ToggleCardButton
            isOpen={isOpenEstanque}
            onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
          />
        </Card>
        <DropdownCard
          className="mb-4 d-below-1500-none d-1500-block"
          isOpen={isOpenEstanque}
          title="Estanque Hormigón"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelMax={3.5}
          nivelAlarma={1}
        />
      </div>
      {/* Estanque 2 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque Metalico"
            text1={[
              "Nivel",
              `${data.snapshot.estanque_metalico.value.toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${((60 / 7) * data.snapshot.estanque_metalico.value).toFixed(
                2,
              )} m³`,
            ]}
            text3={["Tiempo Vaciado", data.tiempo_vaciado_metalico_formatted]}
            date={data.snapshot.estanque_metalico.time}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.estanque_metalico.value}
            nivelMaximo={3.5}
          />
          <ToggleCardButton
            isOpen={isOpenEstanque2}
            onToggle={() => setIsOpenEstanque2(!isOpenEstanque2)}
          />
        </Card>
        <DropdownCard
          className="mb-4 d-below-1500-none d-1500-block"
          isOpen={isOpenEstanque2}
          title="Estanque Metálico"
          chartLabel="Nivel del Estanque (m)"
          data={nivel2ChartData}
          nivelMax={3.5}
          nivelAlarma={1}
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
              "Nivel Freático Pozo",
              `${(data.snapshot.freatico_pozo.value / 100).toFixed(2)} m`,
            ]}
            text3={[
              "Nivel Freático Sentina",
              `${(data.snapshot.freatico_sentina.value / 100).toFixed(2)} m`,
            ]}
            text4={["Horómetro por Día", minutesToHHMM(ultimoHorometro)]}
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
          nivelMax={4}
        />
        <DropdownCardv2
          isOpen={isOpenBomba}
          title="Horómetro Diario"
          chartLabel="Horómetro"
          data={horometroChartData}
        />
        <DropdownCardv3
          isOpen={isOpenBomba}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizadorChartData}
        />{" "}
        {/* Panel de Estados */}
        <States
          automatico={"1"}
          bomba={data.snapshot.bomba.value.toString()}
          falla={data.snapshot.falla.value.toString()}
        />
      </div>
      <div className="col-12 col-lg-4 mb-1">
        <States
          title="Estado Tablero Eléctrico"
          corriente1={((data.snapshot.i1.value * 2) / 100).toFixed(2)}
          voltaje1={(data.snapshot.v1.value / 10).toFixed(2)}
        />
        <DropdownCardv3
          isOpen={true}
          title="kWh"
          chartLabel="kWh"
          data={kwhChartData}
        />{" "}
        <DropdownCardv4
          isOpen={true}
          title="Voltaje"
          chartLabel="Voltaje (V)"
          data={{
            v1: voltajeChartData.v1,
          }}
          divisor={10}
        />
        <DropdownCardv4
          isOpen={true}
          title="Corriente"
          chartLabel="Corriente (A)"
          data={{
            i1: corrienteChartData.i1,
          }}
          divisor={100}
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
          title="Estanque Hormigón"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelMax={3.5}
          nivelAlarma={1}
        />
      </div>

      {/* Estanque 2 (2,1) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Metálico"
          chartLabel="Nivel del Estanque (m)"
          data={nivel2ChartData}
          nivelMax={3.5}
          nivelAlarma={1}
        />
      </div>

      {/* Caudal (2,2) */}
      <div style={{ gridColumn: "3", gridRow: "3" }}>
        <DropdownCard
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudalChartData}
          nivelMax={4}
        />
      </div>

      {/* Kwh (2,3) */}
      <div style={{ gridColumn: "0", gridRow: "4" }}>
        <DropdownCardv3
          isOpen={true}
          title="kWh"
          chartLabel="kWh"
          data={kwhChartData}
        />
      </div>

      {/* Voltaje (3,0) */}
      <div style={{ gridColumn: "1", gridRow: "4" }}>
        <DropdownCardv4
          isOpen={true}
          title="Voltaje"
          chartLabel="Voltaje"
          data={voltajeChartData}
        />
      </div>

      {/* Corriente (3,1) */}
      <div style={{ gridColumn: "2", gridRow: "4" }}>
        <DropdownCardv4
          isOpen={true}
          title="Corriente"
          chartLabel="Corriente"
          data={corrienteChartData}
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
