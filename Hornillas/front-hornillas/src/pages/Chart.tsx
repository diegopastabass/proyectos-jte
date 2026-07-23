import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import Loading from "./Loading";
import CaudalChart from "../components/CaudalChart";

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

interface CaudalData {
  time: string;
  value: number;
}

const getChileDate = () => {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const Chart = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Datos | null>(null);
  const [caudalData, setCaudalData] = useState<CaudalData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = getChileDate();

        const caudalURL = new URL("https://app.jteanalytics.cl/zuniga/caudal");
        caudalURL.searchParams.append("fechaInicio", today);
        caudalURL.searchParams.append("fechaFin", today);

        const [dataRes, caudalRes] = await Promise.all([
          fetch("https://app.jteanalytics.cl/zuniga/snapshot"),
          fetch(caudalURL.toString()),
        ]);

        const snapshotData: Datos = await dataRes.json();
        const caudalJson: CaudalData[] = await caudalRes.json();

        setData(snapshotData);
        setCaudalData(caudalJson);
      } catch (error) {
        console.error("Error al cargar los datos: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Loading />;
  if (!data) return "No se pudo cargar la información.";

  const cleanDate = data.lastUpdate?.trim().replace(/^"|"$/g, "") || "";

  return (
    <div className="container-fluid py-3">
      <div className="mb-4">
        <Navbar text={cleanDate} />
      </div>

      <div className="card p-3 shadow-sm rounded">
        <h5 className="mb-3">Gráfico de Caudal</h5>
        <CaudalChart data={caudalData} />
      </div>
    </div>
  );
};

export default Chart;
