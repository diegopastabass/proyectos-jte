import Card, { CardBody } from "../components/Card";
import { useEffect, useState } from "react";
import { TankLevelCircular } from "../components/Level";
import Navbar from "../components/Navbar";
import "../index.css";
import Loading from "./Loading";
import ToggleCardButton from "../components/ToggleCardButton";
import DropdownCard from "../components/DropDownCard";
import StatusLed from "../components/StatusLed";
import logo from "../assets/logoJte.png";
import DropdownCardv3 from "../components/DropDownCardv3";
import DropdownCardv2 from "../components/DropDownCardv2";

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

function Home() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [vData, setVaciadoData] = useState<DatosVaciado | null>(null);
  const [totalizador, setTotalizador] = useState<Metric[] | null>(null);

  const [isOpenAlto, setIsOpenAlto] = useState(false);
  const [isOpenBajo, setIsOpenBajo] = useState(false);
  const [isOpenNilahue, setIsOpenNilahue] = useState(false);
  const [isOpenCasuto, setIsOpenCasuto] = useState(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [caudal, setCaudal] = useState<Metric[] | null>(null);



  useEffect(() => {

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const now = new Date();
    const date = formatter.format(now);
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 14);
    const oldDate = formatter.format(fiveDaysAgo);

    const fetchData = async () => {
      try {
        const [metricsRes, vaciadoRes, chartRes, totalizadorRes, caudalRes] = await Promise.all([
          fetch("https://app.jteanalytics.cl/bucalemu/metrics/latest"),
          fetch("https://app.jteanalytics.cl/bucalemu/metrics/emptying"),
          fetch("https://app.jteanalytics.cl/bucalemu/metrics/all"),
          fetch(`https://app.jteanalytics.cl/bucalemu/metrics/totalizador?start=${oldDate}&end=${date}`),
          fetch(`https://app.jteanalytics.cl/bucalemu/metrics/caudal`),
        ]);

        const metricsData: Datos = await metricsRes.json();
        setData(metricsData);

        const vaciadoData: DatosVaciado = await vaciadoRes.json();
        setVaciadoData(vaciadoData);

        const chartData: ChartData = await chartRes.json();
        setChartData(chartData);

        const totalizadorData: Metric[] = await totalizadorRes.json();
        setTotalizador(totalizadorData)

        const caudalData: Metric[] = await caudalRes.json();
        setCaudal(caudalData)

        const allTimes = Object.values(metricsData).map((m) =>
          new Date(m.time).getTime()
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
  }, []);

  if (loading) return <Loading />;

  if (!data || !vData)
    return (
      <p className="text-center mt-5">No se pudo cargar la información.</p>
    );

  const vaciadoText = (time: string) =>
    time === "0s" ? "Llenando..." : `Vaciado: ${time}`;

  return (
    <main className="container-fluid d-flex flex-column min-vh-100 p-3">
      <Navbar text={lastUpdate} />

      <section className="row g-4 justify-content-center align-items-start my-3">
        {/* Bucalemu Alto */}
        <div className="col-12 col-md-6 col-lg-3">
          <Card>
            <CardBody
              title="Bucalemu Alto"
              text1={`Nivel: ${data.ssr_bucalemu_alto_nivel.value.toFixed(
                2
              )} m`}
              text2={vaciadoText(vData.t_vaciado_bucalemu_alto_nivel)}
              date={data.ssr_bucalemu_alto_nivel.time}
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
            isOpen={isOpenAlto}
            title="Bucalemu Alto"
            data={chartData?.ssr_bucalemu_alto_nivel || []}
            chartLabel="Nivel Estanque"
            nivelAlarma={1}
            nivelMax={5}
          />
        </div>

        {/* Bucalemu Bajo */}
        <div className="col-12 col-md-6 col-lg-3">
          <Card>
            <CardBody
              title="Bucalemu Bajo"
              text1={`Nivel: ${data.ssr_bucalemu_bajo_nivel.value.toFixed(
                2
              )} m`}
              text2={`Temperatura: ${data.ssr_bucalemu_bajo_temperatura.value.toFixed(
                1
              )} °C`}
              text4={vaciadoText(vData.t_vaciado_bucalemu_bajo_nivel)}
              date={data.ssr_bucalemu_bajo_nivel.time}
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
            isOpen={isOpenBajo}
            title="Bucalemu Bajo"
            data={chartData?.ssr_bucalemu_bajo_nivel || []}
            chartLabel="Nivel Estanque"
            nivelAlarma={1}
            nivelMax={5}
          />
        </div>

        {/* Nilahue */}
        <div className="col-12 col-md-6 col-lg-3">
          <Card>
            <CardBody
              title="Nilahue"
              text1={`Nivel: ${data.ssr_nilahue_nivel.value.toFixed(2)} m`}
              text2={`Caudal: ${data.ssr_nilahue_caudal.value.toFixed(2)} l/s`}
              text3={`Totalizador: ${data.ssr_nilahue_totalizador.value.toFixed(0)} m³`}
              text4={vaciadoText(vData.t_vaciado_nilahue_nivel)}
              date={data.ssr_nilahue_nivel.time}
            />
            <p>
              <StatusLed
                status={data.ssr_nilahue_bomba.value}
                label="Estado Bomba Hacia Casuto"
              ></StatusLed>
            </p>
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
            isOpen={isOpenNilahue}
            title="Nilahue"
            data={chartData?.ssr_nilahue_nivel || []}
            chartLabel="Nivel Estanque"
            nivelAlarma={1}
            nivelMax={5}
          />
          <DropdownCardv2
            isOpen={isOpenNilahue}
            title="Nilahue"
            data={caudal || []}
            chartLabel="Caudal"
            nivelMax={25}
          />
          <DropdownCardv3
            isOpen={isOpenNilahue}
            title="Nilahue"
            data={totalizador || []}
            chartLabel="Totalizador Por día"
          />
        </div>

        {/* Casuto */}
        <div className="col-12 col-md-6 col-lg-3">
          <Card>
            <CardBody
              title="Casuto"
              text1={`Nivel: ${data.ssr_casuto_nivel.value.toFixed(2)} m`}
              text2={`Batería: ${(data.ssr_casuto_bateria.value / 1000).toFixed(2)} V`}
              text3={vaciadoText(vData.t_vaciado_casuto_nivel)}
              date={data.ssr_casuto_nivel.time}
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
            isOpen={isOpenCasuto}
            title="Casuto"
            data={chartData?.ssr_casuto_nivel || []}
            chartLabel="Nivel Estanque"
            nivelAlarma={1}
            nivelMax={5}
          />
        </div>
      </section>

      <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top mt-auto">
        <p className="mb-0 text-body-secondary">&copy; 2025 JTE Analytics.</p>
        <img src={logo} alt="logo" width={40} height={24} />
      </footer>
    </main>
  );
}

export default Home;
