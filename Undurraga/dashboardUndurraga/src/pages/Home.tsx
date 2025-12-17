import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import MetricCard from "../components/MetricCard";
import TimeSeriesChart from "../components/TimeSeriesChart";
import Loading from "./Loading";
import type { Metric, Snapshot } from "../components/types";
import ExportModal from "../components/ExportModal";
import lgoJte from "../assets/logoJte.png";
import { fillMissingDates } from "../assets/utilities";

function Home() {
  const [loading, setLoading] = useState(true);

  const [snapshotData, setSnapshotData] = useState<Snapshot>({} as Snapshot);

  const [piscinaData, setPiscinaData] = useState<Metric[]>([]);

  const [totalizador1Data, setTotalizador1Data] = useState<Metric[]>([]);
  const [totalizador2Data, setTotalizador2Data] = useState<Metric[]>([]);

  const [caudal1Data, setCaudal1Data] = useState<Metric[]>([]);

  const [caudal2Data, setCaudal2Data] = useState<Metric[]>([]);

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
    startDate.setDate(startDate.getDate() - 30);
    const start = formatter.format(startDate);

    const fetchData = async () => {
      try {
        const [
          snapshotRes,
          piscinaRes,
          totalizador1Res,
          totalizador2Res,
          caudal1Res,
          caudal2Res,
        ] = await Promise.all([
          fetch("https://app.jteanalytics.cl/undurraga/snapshot"),
          fetch(
            `https://app.jteanalytics.cl/undurraga/totalizador-piscina?startDate=${start}&endDate=${end}`
          ),
          fetch(
            `https://app.jteanalytics.cl/undurraga/totalizador-1?startDate=${start}&endDate=${end}`
          ),
          fetch(
            `https://app.jteanalytics.cl/undurraga/totalizador-2?startDate=${start}&endDate=${end}`
          ),
          fetch(`https://app.jteanalytics.cl/undurraga/caudal/1`),
          fetch(`https://app.jteanalytics.cl/undurraga/caudal/2`),
        ]);

        const snapshotResJson = await snapshotRes.json();
        setSnapshotData(snapshotResJson);

        const piscinaResJson = await piscinaRes.json();
        setPiscinaData(piscinaResJson);

        const totalizador1ResJson = await totalizador1Res.json();
        setTotalizador1Data(totalizador1ResJson);

        const totalizador2ResJson = await totalizador2Res.json();
        setTotalizador2Data(totalizador2ResJson);

        const caudal1ResJson = await caudal1Res.json();
        setCaudal1Data(caudal1ResJson);

        const caudal2ResJson = await caudal2Res.json();
        setCaudal2Data(caudal2ResJson);
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
          <div className="row g-3 mb-4">
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Caudal Instantáneo 1"
                value={snapshotData[1].value}
                unit="m³/h"
                barColor="success"
              />
            </div>
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Totalizador 1"
                value={snapshotData[4].value}
                unit="m³"
                barColor="danger"
              />
            </div>
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Caudal Instantáneo 2"
                value={snapshotData[2].value}
                unit="m³/h"
                barColor="warning"
              />
            </div>
            <div className="col-lg-3 col-md-6 col-sm-12">
              <MetricCard
                title="Totalizador 2"
                value={snapshotData[3].value}
                unit="m³"
                barColor="warning"
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6 col-md-12">
              <TimeSeriesChart
                title="Totalizador 1 por día"
                metrics={fillMissingDates(totalizador1Data, 30)}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="bar"
              />
            </div>
            <div className="col-lg-6 col-md-12">
              <TimeSeriesChart
                title="Totalizador 2 por día"
                metrics={fillMissingDates(totalizador2Data, 30)}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="bar"
              />
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-12">
              <TimeSeriesChart
                title="Totalizador Piscina"
                metrics={fillMissingDates(piscinaData, 30)}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="bar"
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <TimeSeriesChart
                title="Caudal 1"
                metrics={caudal1Data}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="line"
              />
            </div>

            <div className="col-lg-6">
              <TimeSeriesChart
                title="Caudal 2"
                metrics={caudal2Data}
                barColor="rgba(5, 163, 216, 0.8)"
                chartType="line"
              />
            </div>
          </div>

          
        </div>

        {/* Footer */}
        <footer className="mt-4 w-75 d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top border-secondary">
          <p className="text-body-secondary">&copy; 2025 JTE Analytics.</p>
          <img
            src={lgoJte}
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
