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
import "../index.css";
import { fetchWithCache } from "../components/fetchWithcache";
import logoJte from "../assets/logoJte.png";
import DropdownCardv4 from "../components/DropdownCardv4";

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
  horometro: Metric; //
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
  const [voltajeChartData, setVoltajeData] = useState<{
    L1L2: Metric[];
    L2L3: Metric[];
    L3L1: Metric[];
  }>({
    L1L2: [],
    L2L3: [],
    L3L1: [],
  });
  const [voltajeNeutroChartData, setVoltajeNeutroData] = useState<{
    L1N: Metric[];
    L2N: Metric[];
    L3N: Metric[];
  }>({
    L1N: [],
    L2N: [],
    L3N: [],
  });
  const [corrienteChartData, setCorrienteData] = useState<{
    I1: Metric[];
    I2: Metric[];
    I3: Metric[];
  }>({
    I1: [],
    I2: [],
    I3: [],
  });

  const [totalizadorChartData, setTotalizador] = useState<Metric[]>([]);
  const [horometroChartData, setHorometro] = useState<Metric[]>([]);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1500);
  const [isOpenExport, setIsOpenExport] = useState(false);

  const [isOpenEstanque, setIsOpenEstanque] = useState(isLargeScreen);
  const [isOpenBomba, setIsOpenBomba] = useState(isLargeScreen);

  const nivelMaxEstanque = 3;
  const nivelMaxCaudal = 80;
  const nivelAlarma = 150;

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
        const [
          snapshotRes,
          nivelRes,
          caudalRes,
          voltajeRes,
          voltajeNeutroRes,
          corrienteRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/auquinco/snapshot"),
          fetch(`https://app.jteanalytics.cl/auquinco/nivel`),
          fetch(`https://app.jteanalytics.cl/auquinco/caudal`),
          fetch(`https://app.jteanalytics.cl/auquinco/voltaje`),
          fetch(`https://app.jteanalytics.cl/auquinco/voltaje-neutro`),
          fetch(`https://app.jteanalytics.cl/auquinco/corriente`),
        ]);

        const snapshotData: Snapshot = await snapshotRes.json();
        setData(snapshotData);
        setNivelData(await nivelRes.json());
        setCaudalData(await caudalRes.json());
        setVoltajeData(await voltajeRes.json());
        setVoltajeNeutroData(await voltajeNeutroRes.json());
        setCorrienteData(await corrienteRes.json());

        setTotalizador(await fetchWithCache("totalizador", end));
        setHorometro(await fetchWithCache("horometro", end));
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
  const vistaMovil = (
    <>
      {/* Estanque 1 */}
      <div className="col-12 col-lg-4 mb-1">
        <Card>
          <CardBody
            title="Estanque 1"
            text1={[
              "Nivel",
              `${(data.snapshot.estanque.value / 100).toFixed(2)} m`,
            ]}
            text2={[
              "Volumen Actual",
              `${(((60 / 7) * data.snapshot.estanque.value) / 100).toFixed(2)} m³`,
            ]}
            text3={["Tiempo de Vaciado", data.tiempo_vaciado_formatted]}
          />
          <TankLevelCircular
            nivelActual={data.snapshot.estanque.value / 100}
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
          divisor={100}
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
            text7={["Horómetro Diario", minutesToHHMM(ultimoHorometro)]}
            text8={[
              "Horómetro Total",
              minutesToHHMM(data.snapshot.horometro.value),
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
        <DropdownCardv3
          isOpen={isOpenBomba}
          title="Horómetro"
          chartLabel="Horómetro"
          data={horometroChartData}
        />
      </div>
      {/* Panel de Estados */}
      <States
        title="Estado Tablero"
        automatico={data.snapshot.automatico.value.toString()}
        manual={data.snapshot.manual.value.toString()}
        bomba={data.snapshot.bomba.value.toString()}
      />
      <States
        title="Estado Generador"
        temp={data.snapshot.temp.value.toFixed(2)}
        petroleo={data.snapshot.petroleo.value.toFixed(2)}
        rpm={data.snapshot.rpm.value.toFixed(2)}
      />
      <States
        title="Estado Tablero Eléctrico"
        l1l2={(data.snapshot.L1L2.value / 100).toFixed(2)}
        l2l3={(data.snapshot.L2L3.value / 100).toFixed(2)}
        l3l1={(data.snapshot.L3L1.value / 100).toFixed(2)}
        l1n={(data.snapshot.L1N.value / 100).toFixed(2)}
        l2n={(data.snapshot.L2N.value / 100).toFixed(2)}
        l3n={(data.snapshot.L3N.value / 100).toFixed(2)}
        i1={(data.snapshot.I1.value / 100).toFixed(2)}
        i2={(data.snapshot.I2.value / 100).toFixed(2)}
        i3={(data.snapshot.I3.value / 100).toFixed(2)}
        kw1={(data.snapshot.KW1.value / 10).toFixed(2)}
        kw2={(data.snapshot.KW2.value / 10).toFixed(2)}
        kw3={(data.snapshot.KW3.value / 10).toFixed(2)}
      />
      <div className="col-12 col-lg-4 mb-1">
        <DropdownCardv4
          isOpen={true}
          title="Voltaje"
          chartLabel="Voltaje (V)"
          data={voltajeChartData}
          divisor={100}
        />
        <DropdownCardv4
          isOpen={true}
          title="Voltaje Neutro"
          chartLabel="Voltaje (V)"
          data={voltajeNeutroChartData}
          divisor={100}
        />
        <DropdownCardv4
          isOpen={true}
          title="Corriente"
          chartLabel="Corriente (A)"
          data={corrienteChartData}
          divisor={100}
        />
      </div>
    </>
  );

  // =====================
  // VISTA DESKTOP
  // =====================
  const vistaDesktop = (
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
      {/* Estanque 1 (2,0) */}
      <div style={{ gridColumn: "3", gridRow: "1" }}>
        <DropdownCard
          isOpen={true}
          title="Estanque Nuevo"
          chartLabel="Nivel del Estanque (m)"
          data={nivelChartData}
          nivelMax={4}
          divisor={100}
          nivelAlarma={nivelAlarma}
        />
      </div>

      {/* Caudal (2,2) */}
      <div style={{ gridColumn: "3", gridRow: "2" }}>
        <DropdownCard
          isOpen={true}
          title="Caudal"
          chartLabel="Caudal de Impulsión (l/s)"
          data={caudalChartData}
          nivelMax={nivelMaxCaudal}
        />
      </div>

      {/* Horómetro + Totalizador (row 3, 50/50) */}
      <div
        style={{
          gridColumn: "1 / -1",
          gridRow: "3",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <DropdownCardv2
          isOpen={true}
          title="Horómetro Diario"
          chartLabel="Horómetro"
          data={horometroChartData}
        />
        <DropdownCardv3
          isOpen={true}
          title="Totalizador Diario"
          chartLabel="Totalizador en m³"
          data={totalizadorChartData}
        />
      </div>

      <div style={{ gridColumn: "1", gridRow: "4" }}>
        <DropdownCardv4
          isOpen={true}
          title="Voltaje"
          chartLabel="Voltaje (V)"
          divisor={100}
          data={voltajeChartData}
        />
      </div>

      <div style={{ gridColumn: "2", gridRow: "4" }}>
        <DropdownCardv4
          isOpen={true}
          title="Voltaje Neutro"
          chartLabel="Voltaje (V)"
          divisor={100}
          data={voltajeNeutroChartData}
        />
      </div>

      <div style={{ gridColumn: "3", gridRow: "4" }}>
        <DropdownCardv4
          isOpen={true}
          title="Corriente"
          chartLabel="Corriente (A)"
          data={corrienteChartData}
          divisor={100}
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
          {isLargeScreen ? vistaDesktop : vistaMovil}
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
