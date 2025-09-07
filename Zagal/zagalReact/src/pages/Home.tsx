import Navbar from "../components/Navbar";
import "../index.css";
import Card from "../components/Card";
import SectorTable from "../components/SectorTable";
import { useEffect, useState } from "react";
import Loading from "./Loading";
import Heatmap from "../components/RiegoHeatMap";

interface IrrigationInterval {
  tiempo_inicio: string;
  tiempo_fin: string;
  tiempo_riego_segundos: number;
  caudal_promedio: number;
  volumen: number;
}

interface Caudal {
  mt_value: string;
}

interface IrrigationRange {
  mt_name: string;
  date: string;
  value: number;
}

function Home() {
  const [loading, setLoading] = useState(true);
  const [irrigationIntervals, setIrrigationIntervals] = useState<
    IrrigationInterval[]
  >([]);
  const [caudal, setCaudal] = useState<Caudal[]>([]);
  const [dataRange, setDataRange] = useState<IrrigationRange[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [caudalRes, intervalRes, rangeRes] = await Promise.all([
          fetch("http://localhost:3003/zagal/caudal"),
          fetch("http://localhost:3003/zagal/interval"),
          fetch(
            "http://localhost:3003/zagal/range?startDate=2024-12-02&endDate=2024-12-11"
          ),
        ]);

        const caudalData = await caudalRes.json();
        setCaudal(caudalData);

        const intervalData: IrrigationInterval[] = await intervalRes.json();
        setIrrigationIntervals(intervalData);

        const dataRange: IrrigationRange[] = await rangeRes.json();
        setDataRange(dataRange);
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
  if (loading) {
    return <Loading></Loading>;
  }
  const latestInterval = irrigationIntervals[0];
  const sectores = [
    {
      sector: "sector 1",
      estado: "1",
      horometro: latestInterval.tiempo_riego_segundos,
      volumen: latestInterval.volumen,
      caudal: Number(caudal[0].mt_value).toFixed(2),
    },
  ];
  return (
    <>
      <div className="container-fluid py-3">
        {/* Navbar */}
        <div className="mb-4">
          <Navbar text="2025-08-21" />
        </div>

        {/* Tarjetas */}
        <div
          className="d-flex flex-column flex-lg-row justify-content-center align-items-stretch gap-4 mx-auto"
          style={{ maxWidth: "1500px" }}
        >
          <div>
            <Card>
              <SectorTable data={sectores} />
              <Heatmap
                data={dataRange}
                sector="PARC_57_ZAGAL--slave.sector1"
                month={12}
                year={2024}
              ></Heatmap>
            </Card>
          </div>
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

export default Home;
