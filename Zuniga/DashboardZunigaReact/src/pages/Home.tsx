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

interface Datos {
  falla: string;
  bomba: string;
  automatico: string;
  estanque: number;
  estanque_2: number;
  caudal: number;
  freatico: number;
  presion: number;
  horometro_total: number;
  horometro_diario: number;
  totalizador_total: number;
  totalizador_diario: number;
  lastUpdate: string;
}

interface Vaciado {
  tiempoVaciadoSegundo: number;
  tiempoVaciado: string;
}

interface ChartDataEstanque1 {
  value: number;
  time: string;
}

interface ChartDataEstanque2 {
  value: number;
  time: string;
}

interface ChartDataCaudal {
  value: number;
  time: string;
}

interface ChartDataHorometro {
  key: string;
  value: number;
}

interface ChartDataTotalizador {
  key: string;
  value: number;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [vaciado, setTiempoVaciado] = useState<Vaciado | null>(null);
  const [nivelEstanque1, setNivelEstanque1] = useState<ChartDataEstanque1[]>(
    []
  );
  const [nivelEstanque2, setNivelEstanque2] = useState<ChartDataEstanque2[]>(
    []
  );
  const [caudal, setCaudal] = useState<ChartDataCaudal[]>([]);
  const [horometro, setHorometro] = useState<ChartDataHorometro[]>([]);
  const [totalizador, setTotalizador] = useState<ChartDataTotalizador[]>([]);

  const [isOpenEstanque, setIsOpenEstanque] = useState(false);
  const [isOpenEstanque2, setIsOpenEstanque2] = useState(false);
  const [isOpenBomba, setIsOpenBomba] = useState(false);

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
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const oldDate = formatter.format(fiveDaysAgo);

    const fetchData = async () => {
      try {
        const [
          snapshotRes,
          estanqueRes,
          nivelEstanque1Res,
          nivelEstanque2Res,
          caudalRes,
          horometroRes,
          totalizadorRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/zuniga/snapshot"),
          fetch("https://app.jteanalytics.cl/zuniga/estanque"),
          fetch(
            `https://app.jteanalytics.cl/zuniga/nivelestanque1?fechaInicio=${date}&fechaFin=${date}`
          ),
          fetch(
            `https://app.jteanalytics.cl/zuniga/nivelestanque2?fechaInicio=${date}&fechaFin=${date}`
          ),
          fetch(
            `https://app.jteanalytics.cl/zuniga/caudal?fechaInicio=${date}&fechaFin=${date}`
          ),
          fetch(
            `https://app.jteanalytics.cl/zuniga/horometro?fechaInicio=${oldDate}&fechaFin=${date}`
          ),
          fetch(
            `https://app.jteanalytics.cl/zuniga/totalizador?fechaInicio=${oldDate}&fechaFin=${date}`
          ),
        ]);

        const snapshotData: Datos = await snapshotRes.json();
        const estanqueData = await estanqueRes.json();

        const nivelEstanque1Data = await nivelEstanque1Res.json();
        const nivelEstanque2Data = await nivelEstanque2Res.json();

        const caudalData = await caudalRes.json();

        const horometroData = await horometroRes.json();

        const totalizadorData = await totalizadorRes.json();

        setData(snapshotData);
        setTiempoVaciado(estanqueData);
        setNivelEstanque1(nivelEstanque1Data);
        setNivelEstanque2(nivelEstanque2Data);
        setCaudal(caudalData);
        setHorometro(horometroData);
        setTotalizador(totalizadorData);
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

  if (loading)
    return (
      <>
        <Loading></Loading>
      </>
    );
  if (!data) {
    return <Error />;
  }
  if (!vaciado) {
    return <Error />;
  }
  if (!nivelEstanque1) {
    return <Error />;
  }
  if (!nivelEstanque2) {
    return <Error />;
  }
  if (!caudal) {
    return <Error></Error>;
  }
  if (!horometro) {
    return <Error></Error>;
  }

  const cleanDate = data?.lastUpdate?.trim().replace(/^"|"$/g, "");

  function evaluate(t = vaciado?.tiempoVaciado) {
    if (t == "00:00:00") {
      return "Llenando...";
    } else {
      return "Tiempo de Vaciado: " + t + " h";
    }
  }

  const horHoras = (data.horometro_diario - (data.horometro_diario % 60)) / 60;
  const horMinutos = data.horometro_diario % 60;

  return (
    <>
      <div className="container-fluid py-3">
        {/* Navbar */}
        <div className="mb-4">
          <Navbar text={cleanDate} />
        </div>

        {/* Tarjetas */}
        <div
          className="d-flex flex-column flex-lg-row justify-content-center align-items-stretch gap-4 mx-auto"
          style={{ maxWidth: "1500px" }}
        >
          {/*Estanque 1*/}
          <div className="col-12 col-md-6 col-lg-3">
            <Card>
              <CardBody
                title="Estanque 350 m³"
                text1={"Nivel: " + data.estanque?.toFixed(2) + " m"}
                text2={evaluate(vaciado?.tiempoVaciado)}
              />
              <TankLevelCircular nivelActual={data.estanque} nivelMaximo={7} />

              <ToggleCardButton
                isOpen={isOpenEstanque}
                onToggle={() => setIsOpenEstanque(!isOpenEstanque)}
              />
            </Card>

            <DropdownCard
              isOpen={isOpenEstanque}
              title="Estanque 350 m³"
              chartLabel="Nivel del Estanque (m)"
              data={nivelEstanque1 || []}
            />
          </div>

          {/*Estanque 2*/}
          <div className="col-12 col-md-6 col-lg-3">
            <Card>
              <CardBody
                title="Estanque 2 m³"
                text1={"Nivel: " + data.estanque_2.toFixed(2) + " m"}
              />
              <TankLevelCircular
                nivelActual={data.estanque_2}
                nivelMaximo={2}
              />
              <ToggleCardButton
                isOpen={isOpenEstanque2}
                onToggle={() => setIsOpenEstanque2(!isOpenEstanque2)}
              />
            </Card>
            <DropdownCard
              isOpen={isOpenEstanque2}
              title="Estanque 2 m³"
              chartLabel="Nivel del Estanque (m)"
              data={nivelEstanque2 || []}
            />
          </div>

          {/*Bomba*/}
          <div className="col-12 col-md-6 col-lg-3">
            <Card>
              <CardBody
                title="Bomba"
                text1={"Caudal Impulsion: " + data.caudal.toFixed(2) + " l/s"}
                text2={
                  "Nivel Freático: " + (data.freatico / 100).toFixed(2) + " m"
                }
                text3={"Presión: " + (data.presion / 10).toFixed(1) + " bar"}
                text4={"Horómetro: " + horHoras + ":" + horMinutos + " h"}
                text5={
                  "Totalizador: " + data.totalizador_diario.toFixed(2) + " m³"
                }
                text6={
                  "Totalizador Total: " +
                  data.totalizador_total.toFixed(2) +
                  " m³"
                }
              ></CardBody>

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
            />

            <DropdownCardv2
              isOpen={isOpenBomba}
              title="Horometro Diario"
              chartLabel="Horometro"
              data={horometro || []}
            />

            <DropdownCardv3
              isOpen={isOpenBomba}
              title="Totalizador Diario"
              chartLabel="Totalizador"
              data={totalizador || []}
            />
          </div>

          {/*Estado Tablero*/}
          <State>
            <StateBody
              automatico={data.automatico.toString()}
              bomba={data.bomba.toString()}
              falla={data.falla.toString()}
            />
          </State>
        </div>

        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
          <p className="mb-0 text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img
            src="/src/assets/logoJte.png"
            alt="logo"
            width={40}
            height={24}
          />
        </footer>
      </div>
    </>
  );
}

export default App;
