import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggleCardButton";
import DropdownCard from "../components/DropDownCard";
import StatusLed from "../components/StatusLed";
import ExportHistorial from "../components/ExportarHistorial";
import LoginModal from "../components/LoginModal";
import AdminCard from "../components/AdminCard";
import VpdBadge from "../components/VpdBadge";
import VpdChart from "../components/VpdChart";
import logoJte from "../assets/logoJte.png";

interface Metric {
  value: number;
  time: string;
}

interface Limits {
  min: number;
  max: number;
}

interface LimitsResponse {
  3: Limits; // Humedad Calor
  4: Limits; // Humedad Frio
  5: Limits; // Temperatura Calor
  6: Limits; // Temperatura Frio
  7: Limits; // Temperatura Ambiente
  8: Limits; // Humedad Ambiente
}

interface Datos {
  1: Metric; // Estado Calor
  2: Metric; // Estado Frio
  3: Metric; // Humedad Calor
  4: Metric; // Humedad Frio
  5: Metric; // Temperatura Calor
  6: Metric; // Temperatura Frio
  7: Metric; // Temperatura Ambiente
  8: Metric; // Humedad Ambiente
  vpd_calor?: number;
  vpd_frio?: number;
  vpd_ambiente?: number;
}

interface Graph {
  3: Metric[];
  4: Metric[];
  5: Metric[];
  6: Metric[];
  7: Metric[];
  8: Metric[];
}

const getChileanDateString = (): string => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  const formatter = new Intl.DateTimeFormat("es-CL", options);

  const dateInChile = new Date();

  const parts = formatter.formatToParts(dateInChile);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split("T")[0];
};

function Home() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [graph, setGraph] = useState<Graph | null>(null);

  const [isOpenCalor, setIsOpenCalor] = useState(false);
  const [isOpenFrio, setIsOpenFrio] = useState(false);
  const [isOpenAmbiente, setIsOpenAmbiente] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const date = getChileanDateString();

  const [limits, setLimits] = useState<LimitsResponse | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, graphRes, limitsRes] = await Promise.all([
          fetch("https://app.jteanalytics.cl/viveros/latest"),
          fetch("https://app.jteanalytics.cl/viveros/chart"),
          fetch(`https://app.jteanalytics.cl/viveros/min-max?date=${date}`),
        ]);

        const metricsData: Datos = await metricsRes.json();
        setData(metricsData);

        const graphData: Graph = await graphRes.json();
        setGraph(graphData);

        const limitsData: LimitsResponse = await limitsRes.json();
        setLimits(limitsData);

        const allTimes = Object.values(metricsData).map((m) =>
          new Date(m.time).getTime(),
        );
        setLastUpdate(new Date(Math.max(...allTimes)).toISOString());
      } catch (error) {
        console.error("Error al cargar datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 120000);
    return () => clearInterval(intervalId);
  }, [date]);



  if (loading) return <Loading />;

  if (!data || Object.keys(data).length === 0)
    return (
      <p className="text-center mt-5">No se pudo cargar la información.</p>
    );

  return (
    <div className="container-fluid min-vh-100 p-3 d-flex flex-column align-items-center">
      <Navbar text={lastUpdate}>
        {token ? (
          <button
            className="btn btn-outline-danger"
            onClick={() => {
              setUserRole(null);
              setToken(null);
            }}
          >
            Logout
          </button>
        ) : (
          <button
            className="btn btn-outline-primary"
            onClick={() => setLoginOpen(true)}
          >
            Login
          </button>
        )}

        <LoginModal
          show={loginOpen}
          onClose={() => setLoginOpen(false)}
          onLoginSuccess={(role, accessToken) => {
            setUserRole(role);
            setToken(accessToken);
          }}
        />
      </Navbar>

      <div className="d-flex flex-column align-items-center w-100 mt-4">
        {/* Ambiente */}
        <div className="col-12 col-md-10 col-lg-6 mb-4">
          <Card>
            <h5 className="mb-2">Ambiente</h5>
            {/* Sección de Temperatura */}
            <Card>
              <div className="d-flex flex-column mb-3">
                <h6 className="mb-2">Temperatura</h6>
                <CardBody
                  text1={`Actual: ${data[7].value}°C`}
                  text3={`Máxima: ${limits?.[7]?.max}°C`}
                  text4={`Mínima: ${limits?.[7]?.min}°C`}
                />
              </div>
            </Card>

            {/* Sección de Humedad */}
            <Card>
              <div className="d-flex flex-column mb-3">
                <h6 className="mb-2">Humedad</h6>
                <CardBody
                  text1={`Actual: ${data[8].value}%`}
                  text3={`Máxima: ${limits?.[8]?.max}%`}
                  text4={`Mínima: ${limits?.[8]?.min}%`}
                />
              </div>
            </Card>

            {/* VPD Ambiente */}
            {data.vpd_ambiente !== undefined && (
              <div className="px-2 pb-1">
                <VpdBadge vpd={data.vpd_ambiente} />
              </div>
            )}

            <ToggleCardButton
              isOpen={isOpenAmbiente}
              onToggle={() => setIsOpenAmbiente(!isOpenAmbiente)}
            />
          </Card>
          <DropdownCard
            isOpen={isOpenAmbiente}
            title="Temperatura Ambiente"
            label="Variación de Temperatura"
            color="green"
            data={graph?.[7] || []}
          />
          <DropdownCard
            isOpen={isOpenAmbiente}
            title="Humedad Ambiente"
            label="Relación de Humedad"
            color="green"
            data={graph?.[8] || []}
          />
          {/* Gráfico VPD Ambiente */}
          {isOpenAmbiente && graph?.[7]?.length && graph?.[8]?.length ? (
            <div className="card w-100 mb-1">
              <div className="card-body">
                <h6 className="card-title mb-3">VPD – Ambiente</h6>
                <VpdChart
                  tempData={graph[7]}
                  humData={graph[8]}
                  zoneName="Ambiente"
                  color="rgba(25,135,84,1)"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Cámara de Frío */}
        <div className="col-12 col-md-10 col-lg-6 mb-4">
          <Card>
            <h5 className="mb-2">Cámara de Frío</h5>
            <Card>
              {/* Sección de Temperatura */}
              <div className="d-flex flex-column mb-3">
                <h6 className="mb-2">Temperatura</h6>
                <CardBody
                  text1={`Actual: ${data[6].value}°C`}
                  text3={`Máxima: ${limits?.[6]?.max}°C`}
                  text4={`Mínima: ${limits?.[6]?.min}°C`}
                />
              </div>
            </Card>
            {/* Sección de Humedad */}
            <Card>
              <div className="d-flex flex-column mb-3">
                <h6 className="mb-2">Humedad</h6>
                <CardBody
                  text2={`Actual: ${data[4].value}%`}
                  text5={`Máxima: ${limits?.[4]?.max}%`}
                  text6={`Mínima: ${limits?.[4]?.min}%`}
                />
              </div>
            </Card>

            {/* VPD Frío */}
            {data.vpd_frio !== undefined && (
              <div className="px-2 pb-1">
                <VpdBadge vpd={data.vpd_frio} />
              </div>
            )}

            {/* Indicadores visuales */}
            <StatusLed status={data[2].value} />

            {/* Botón de toggle */}
            <ToggleCardButton
              isOpen={isOpenFrio}
              onToggle={() => setIsOpenFrio(!isOpenFrio)}
            />
          </Card>

          <DropdownCard
            isOpen={isOpenFrio}
            title="Cámara de Frío - Temperatura"
            label="Variación de Temperatura °C"
            color="blue"
            data={graph?.[6] || []}
          />
          <DropdownCard
            isOpen={isOpenFrio}
            title="Cámara de Frío - Humedad"
            label="Relación de Humedad"
            color="blue"
            data={graph?.[4] || []}
          />
          {/* Gráfico VPD Frío */}
          {isOpenFrio && graph?.[6]?.length && graph?.[4]?.length ? (
            <div className="card w-100 mb-1">
              <div className="card-body">
                <h6 className="card-title mb-3">VPD – Cámara de Frío</h6>
                <VpdChart
                  tempData={graph[6]}
                  humData={graph[4]}
                  zoneName="Frío"
                  color="rgba(13,110,253,1)"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Cámara de Calor */}
        <div className="col-12 col-md-10 col-lg-6 mb-4">
          <Card>
            <h5 className="mb-2">Cámara de Calor</h5>
            <Card>
              {/* Sección de Temperatura */}
              <div className="d-flex flex-column mb-3">
                <h6 className="mb-2">Temperatura</h6>
                <CardBody
                  text1={`Actual: ${data[5].value}°C`}
                  text3={`Máxima: ${limits?.[5]?.max}°C`}
                  text4={`Mínima: ${limits?.[5]?.min}°C`}
                />
              </div>
            </Card>
            {/* Sección de Humedad */}
            <Card>
              <div className="d-flex flex-column mb-3">
                <h6 className="mb-2">Humedad</h6>
                <CardBody
                  text2={`Actual: ${data[3].value}%`}
                  text5={`Máxima: ${limits?.[3]?.max}%`}
                  text6={`Mínima: ${limits?.[3]?.min}%`}
                />
              </div>
            </Card>

            {/* VPD Calor */}
            {data.vpd_calor !== undefined && (
              <div className="px-2 pb-1">
                <VpdBadge vpd={data.vpd_calor} />
              </div>
            )}

            <StatusLed status={data[1].value} />
            <ToggleCardButton
              isOpen={isOpenCalor}
              onToggle={() => setIsOpenCalor(!isOpenCalor)}
            />
          </Card>

          <DropdownCard
            isOpen={isOpenCalor}
            title="Cámara de Calor - Temperatura"
            label="Variación de Temperatura"
            color="red"
            data={graph?.[5] || []}
          />
          <DropdownCard
            isOpen={isOpenCalor}
            title="Cámara de Calor - Humedad"
            label="Relación de Humedad"
            color="red"
            data={graph?.[3] || []}
          />
          {/* Gráfico VPD Calor */}
          {isOpenCalor && graph?.[5]?.length && graph?.[3]?.length ? (
            <div className="card w-100 mb-1">
              <div className="card-body">
                <h6 className="card-title mb-3">VPD – Cámara de Calor</h6>
                <VpdChart
                  tempData={graph[5]}
                  humData={graph[3]}
                  zoneName="Calor"
                  color="rgba(220,53,69,1)"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Exportar */}
        <div className="col-12 col-md-10 col-lg-6 mb-4">
          <Card>
            <h5 className="mb-2">Exportar</h5>
            <ExportHistorial />

          </Card>
        </div>
      </div>

      {userRole === "0" && token && <AdminCard token={token} />}

      <footer className="d-flex flex-wrap justify-content-center align-items-center py-3 px-4 border-top mt-auto">
        <p className="mb-0 text-body-secondary">&copy; 2025 JTE Analytics.</p>
        <img src={logoJte} alt="logo" width={40} height={24} className="ms-2" />
      </footer>
    </div>
  );
}

export default Home;
