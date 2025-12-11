import Navbar from "../components/Navbar";
import "../index.css";
import Card, { CardBody } from "../components/Card";
import SectorTable from "../components/SectorTable";
import { useEffect, useState } from "react";
import Loading from "./Loading";
import Heatmap from "../components/RiegoHeatMap";
import ParcelaMapa from "../components/ParcelaMapa";
import rawGeoData from "../assets/zagal.json";
import type { FeatureCollection, Point, Polygon } from "geojson";
import "bootstrap/dist/css/bootstrap.min.css";
import ExportHistorial from "../components/ExportHistorial";

interface IrrigationInterval {
  mt_name: string;
  is_active: number;
  tiempo_riego_segundos: number;
  totalizador: number;
}

interface Metric {
  caudal: number;
  totalizador: number;
}

function Home() {
  const [loading, setLoading] = useState(true);
  const [irrigationIntervals, setIrrigationIntervals] = useState<
    IrrigationInterval[]
  >([]);
  const [metric, setMetrics] = useState<Metric | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const parcelaMap: { [key: string]: string } = {
    "SECTOR 1": "Sector 1",
    "SECTOR 2": "Sector 2",
    "SECTOR 3": "Sector 3",
    "SECTOR 4": "Sector 4",
    "SECTOR 5": "Sector 5",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricRes, intervalRes, updateRes] = await Promise.all([
          fetch("https://app.jteanalytics.cl/zagal/18/metrics"),
          fetch("https://app.jteanalytics.cl/zagal/18/interval"),
          fetch("https://app.jteanalytics.cl/zagal/18/update"),
        ]);

        setMetrics(await metricRes.json());

        setIrrigationIntervals(await intervalRes.json());
        setLastUpdate(await updateRes.json());
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

  const parcelas = Array.from(new Set(Object.keys(parcelaMap)));
  const [selectedParcela, setSelectedParcela] = useState(parcelas[0]);

  const handleParcelaChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedParcela(event.target.value);
  };

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const MIN_YEAR = 2025;
  const MIN_MONTH = 9;

  const handleMonthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = Number(event.target.value);

    if (selectedYear === MIN_YEAR && newMonth < MIN_MONTH) return;
    setSelectedMonth(newMonth);
  };

  const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = Number(event.target.value);

    if (newYear === MIN_YEAR && selectedMonth < MIN_MONTH) {
      setSelectedMonth(MIN_MONTH);
    }
    setSelectedYear(newYear);
  };

  if (loading) return <Loading />;

  return (
    <div className="container-fluid py-3 d-flex flex-column align-items-center">
      {/* Navbar */}
      <Navbar text={lastUpdate} />

      {/* Tarjetas y Tabla */}
      <div
        className="d-flex flex-column flex-lg-row flex-wrap justify-content-center align-items-stretch gap-4 mt-4"
        style={{ maxWidth: "1500px", width: "100%" }}
      >
        {/* Tabla de sectores */}
        <div className="w-100 w-lg-50">
          <Card>
            <CardBody title="Sectores Activos" />
            <SectorTable data={irrigationIntervals} />
            <p
              className="
        text-body-primary mb-1 me-2 fw-bold 
        d-flex flex-column 
        w-50 w-lg-25 flex-shrink-0 flex-grow-0
      "
            >
              <span
                className={`
          p-1 border rounded-1 mb-1 
          ${
            (metric?.caudal ?? 0) > 0
              ? "border-success"
              : "border-secondary-subtle"
          }
        `}
              >
                Caudal: {Number(metric?.caudal).toFixed(1) ?? 0} l/s
              </span>

              <span className="p-1 border border-secondary-subtle rounded-1">
                Totalizador: {Number(metric?.totalizador).toFixed(1) ?? 0} m³
              </span>
            </p>
          </Card>
        </div>

        <div className="w-100 w-lg-50">
          <Card>
            <CardBody title="Sectores de Riego" />
            <ParcelaMapa
              geoData={
                rawGeoData as FeatureCollection<
                  Polygon | Point,
                  { name: string }
                >
              }
              irrigationIntervals={irrigationIntervals}
            />
          </Card>
        </div>

        <div className="w-100 w-lg-25">
          <Card>
            <CardBody title="Historial de Riego" />

            {/* Selector de sector */}
            <div className="mb-3 mx-3">
              <label htmlFor="parcela-select" className="form-label">
                Seleccionar Parcela:
              </label>
              <select
                id="parcela-select"
                className="form-select"
                value={selectedParcela}
                onChange={handleParcelaChange}
              >
                {Object.entries(parcelaMap).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de mes */}
            <div className="mb-3 mx-3">
              <label htmlFor="month-select" className="form-label">
                Seleccionar Mes:
              </label>
              <select
                id="month-select"
                className="form-select"
                value={selectedMonth}
                onChange={handleMonthChange}
              >
                {[
                  "Enero",
                  "Febrero",
                  "Marzo",
                  "Abril",
                  "Mayo",
                  "Junio",
                  "Julio",
                  "Agosto",
                  "Septiembre",
                  "Octubre",
                  "Noviembre",
                  "Diciembre",
                ].map((mes, index) => (
                  <option
                    key={index}
                    value={index + 1}
                    disabled={
                      selectedYear === MIN_YEAR && index + 1 < MIN_MONTH
                    }
                  >
                    {mes}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de año */}
            <div className="mb-3 mx-3">
              <label htmlFor="year-select" className="form-label">
                Seleccionar Año:
              </label>
              <select
                id="year-select"
                className="form-select"
                value={selectedYear}
                onChange={handleYearChange}
              >
                {Array.from(
                  { length: new Date().getFullYear() - MIN_YEAR + 1 },
                  (_, i) => MIN_YEAR + i
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Mostrar mes y año seleccionados */}
            <p className="text-end text-body-secondary mb-2 me-3">
              {
                [
                  "Enero",
                  "Febrero",
                  "Marzo",
                  "Abril",
                  "Mayo",
                  "Junio",
                  "Julio",
                  "Agosto",
                  "Septiembre",
                  "Octubre",
                  "Noviembre",
                  "Diciembre",
                ][selectedMonth - 1]
              }{" "}
              - {selectedYear}
            </p>

            {/* Heatmap */}
            <Heatmap
              sector={selectedParcela}
              month={selectedMonth}
              year={selectedYear}
            />
          </Card>
        </div>

        <div className="w-100 w-lg-25">
          <Card>
            <CardBody title="Exportar Historial de Riego" />
            <ExportHistorial />
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top mt-4"
        style={{ maxWidth: "1500px", width: "100%" }}
      >
        <p className="mb-2 mb-md-0 text-body-secondary">
          &copy; 2025 JTE Analytics.
        </p>
        <img
          src="/src/assets/logoJte.png"
          alt="logo"
          width={40}
          height={24}
          className="ms-0 ms-md-auto"
        />
      </footer>
    </div>
  );
}

export default Home;
