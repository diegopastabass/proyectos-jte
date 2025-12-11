// Home.tsx

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import Loading from "./Loading";
import type { Metric, Snapshot } from "../components/types";
import ExportModal from "../components/ExportModal";
import logoJte from "../assets/logoJte.png";

function Home() {
  // HOOKS
  const [loading, setLoading] = useState(true);

  const [snapshotData, setSnapshotData] = useState<Snapshot>({} as Snapshot);
  const [totalizadorData, setTotalizadorData] = useState<Metric[]>([]); 
  const [caudalData, setCaudalData] = useState<Metric[]>([]);
  const [nivelData, setNivelData] = useState<Metric[]>([]);

  const [isOpenExport, setIsOpenExport] = useState(false);

  // EFECTO PARA CARGAR DATOS Y REFRESCAR
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit", // Se añade el mes con dos dígitos
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
          caudalRes,
          nivelRes,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/amigos/snapshot"),
          fetch(`https://app.jteanalytics.cl/amigos/totalizador?start=${start}&end=${end}`),
          fetch(`https://app.jteanalytics.cl/amigos/caudal`),
          fetch(`https://app.jteanalytics.cl/amigos/nivel`),
        ]);

        const snapshotResJson = await snapshotRes.json();
        setSnapshotData(snapshotResJson);

        const totalizadorResJson = await totalizadorRes.json();
        setTotalizadorData(totalizadorResJson);

        const caudalResJson = await caudalRes.json();
        setCaudalData(caudalResJson);

        const nivelResJson = await nivelRes.json();
        setNivelData(nivelResJson);
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

  // CARGANDO
  if (loading) return <Loading />;

  // CÁLCULO DE ÚLTIMA MÉTRICA
  const snapshotArray: Metric[] = Object.values(snapshotData);

  const lastMetric = snapshotArray.reduce((a, b) =>
    new Date(a.time) > new Date(b.time) ? a : b
  );

  return (
    <>
      <div className="container-fluid min-vh-100 p-0 d-flex flex-column align-items-center">
        <div className="mb-3 w-100" style={{ maxWidth: "5000px" }}>
          <Navbar text={lastMetric ? lastMetric.time : ""}>
            <button
              className="btn btn-outline-primary bi bi-save"
              onClick={() => setIsOpenExport(true)}
            ></button>
          </Navbar>
        </div>

        <div className="container-fluid flex-grow-1 px-4 mb-1">
          {/* SECCIÓN DE METRIC CARDS */}
          <div className="row g-3 mb-4">
            {/* Metric Card 1: 1/3 en large, apilada en medium/small */}
            <div className="col-lg-4 col-md-12 col-sm-12">
              <MetricCard
                title="Caudal Instantáneo"
                value={(snapshotData.caudal.value / 10).toFixed(2)}
                unit="l/s"
                barColor="success"
              />
            </div>
            {/* Metric Card 2: 1/3 en large, apilada en medium/small */}
            <div className="col-lg-4 col-md-12 col-sm-12">
              <MetricCard
                title="Totalizador"
                value={(snapshotData.totalizador.value / 10).toFixed(2)}
                unit="m³"
                barColor="danger"
              />
            </div>
            {/* Metric Card 3: 1/3 en large, apilada en medium/small */}
            <div className="col-lg-4 col-md-12 col-sm-12">
              <MetricCard
                title="Nivel Pozo"
                value={(snapshotData.pozo.value /10).toFixed(2)}
                unit="m"
                barColor="warning"
              />
            </div>
          </div>

          {/* SECCIÓN DE GRÁFICOS (TIME SERIES CHARTS) */}
          {/* Gráfico 1: Ancho completo en todos los tamaños */}
          <div className="row g-3 mb-3">
            <div className="col-12">
              <TimeSeriesChart
                title="Totalizador por día"
                metrics={totalizadorData}
                barColor="rgba(13, 110, 230, 0.5)"
                chartType="bar"
              />
            </div>
          </div>

          {/* Gráfico 2: Ancho completo en todos los tamaños */}
          <div className="row g-3 mb-3">
            <div className="col-12">
              <TimeSeriesChart
                title="Caudal Instantáneo"
                metrics={caudalData}
                barColor="rgba(13, 110, 230, 1)"
                chartType="line"
              />
            </div>
          </div>

          {/* Gráfico 3: Ancho completo en todos los tamaños */}
          <div className="row g-3 mb-3">
            <div className="col-12">
              <TimeSeriesChart
                title="Nivel Pozo"
                metrics={nivelData}
                barColor="rgba(13, 110, 230, 1)"
                chartType="line"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top border-secondary">
          <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img
            src={logoJte}
            alt="logo"
            width={40}
            height={24}
          />
        </footer>
      </div>
      <ExportModal show={isOpenExport} onClose={() => setIsOpenExport(false)} />
    </>
  );
}

export default Home;