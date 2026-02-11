import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import Loading from "./Loading";
import type { Metric, Latest } from "../components/types";
import ExportModal from "../components/ExportModal";
import lgoJte from "../assets/logoJte.png";
import { fillMissingDates } from "../assets/utilities";
import Error from "./Error";

function Home() {
  const [loading, setLoading] = useState(true);

  const [latestData, setLatestData] = useState<Latest>({} as Latest);

  const [riles_caudal, setRilesCaudal] = useState<Metric[]>([]);

  const [riles_totalizador, setRilesTotalizador] = useState<Metric[]>([]);

  const [general_caudal, setGeneralCaudal] = useState<Metric[]>([]);

  const [general_totalizador, setGeneralTotalizador] = useState<Metric[]>([]);

  const [riles_totalizador_hora, setRilesTotalizadorHora] = useState<Metric[]>(
    [],
  );

  const [isOpenExport, setIsOpenExport] = useState(false);

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
    startDate.setDate(startDate.getDate() - 20);
    const start = formatter.format(startDate);

    const fetchData = async () => {
      try {
        const [
          latestRes,
          riles_totalizadorRes,
          riles_caudalRes,
          general_totalizadorRes,
          general_caudalRes,
          riles_totalizador_horaRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/montes/latest"),
          fetch(
            `https://app.jteanalytics.cl/montes/totalizador/montes_riles_totalizador?start=${start}&end=${end}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/montes/caudal/montes_riles_caudal`,
          ),
          fetch(
            `https://app.jteanalytics.cl/montes/totalizador/montes_general_totalizador?start=${start}&end=${end}`,
          ),
          fetch(
            `https://app.jteanalytics.cl/montes/caudal/montes_general_caudal`,
          ),
          fetch(
            `https://app.jteanalytics.cl/montes/totalizador-hora/montes_riles_totalizador`,
          ),
        ]);

        const latestResJson = await latestRes.json();
        setLatestData(latestResJson);

        const riles_totalizadorResJson = await riles_totalizadorRes.json();
        setRilesTotalizador(riles_totalizadorResJson);

        const riles_caudalResJson = await riles_caudalRes.json();
        setRilesCaudal(riles_caudalResJson);

        const general_totalizadorResJson = await general_totalizadorRes.json();
        setGeneralTotalizador(general_totalizadorResJson);

        const general_caudalResJson = await general_caudalRes.json();
        setGeneralCaudal(general_caudalResJson);

        const riles_totalizador_horaResJson =
          await riles_totalizador_horaRes.json();
        setRilesTotalizadorHora(riles_totalizador_horaResJson);
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
    };
  }, []);

  if (loading) return <Loading />;
  if (!latestData) return <Error />;
  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar>
            <button
              className="btn btn-outline-primary bi bi-save"
              onClick={() => setIsOpenExport(true)}
            ></button>
          </Navbar>
        </div>

        <div className="container-fluid flex-grow-1 px-4 mb-1">
          <div className="row g-3 mb-4">
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Caudal Riles"
                value={latestData.montes_riles_caudal.value.toFixed(2)}
                unit="m³/h"
                barColor="success"
              />
            </div>
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Totalizador Riles"
                value={latestData.montes_riles_totalizador.value.toFixed(2)}
                unit="m³"
                barColor="danger"
              />
            </div>
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Caudal General"
                value={latestData.montes_general_caudal.value.toFixed(2)}
                unit="m³/h"
                barColor="warning"
              />
            </div>
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Totalizador General"
                value={latestData.montes_general_totalizador.value.toFixed(2)}
                unit="m³"
                barColor="warning"
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <TimeSeriesChart
                title="Caudal Riles"
                metrics={riles_caudal}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="line"
                viewMode="hourly"
                showLastUpdate={true}
              />
            </div>

            <div className="col-lg-6">
              <TimeSeriesChart
                title="Caudal General"
                metrics={general_caudal}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="line"
                viewMode="hourly"
                showLastUpdate={true}
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6 col-md-12">
              <TimeSeriesChart
                title="Totalizador Riles por día"
                metrics={fillMissingDates(riles_totalizador, 20)}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="bar"
              />
            </div>
            <div className="col-lg-6 col-md-12">
              <TimeSeriesChart
                title="Totalizador General por día"
                metrics={fillMissingDates(general_totalizador, 20)}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="bar"
              />
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-12">
              <TimeSeriesChart
                title="Totalizador Riles por hora"
                metrics={riles_totalizador_hora}
                viewMode="hourly"
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="bar"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top border-secondary">
          <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img src={lgoJte} alt="logo" width={40} height={24} />
        </footer>
      </div>
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default Home;
