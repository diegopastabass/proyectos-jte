import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import StatusLed from "./StatusLed";

interface SectorData {
  mt_name: string;
  is_active: number;
  tiempo_riego_segundos: number;
  totalizador: number;
}

interface Props {
  data: SectorData[];
}

const formatIrrigationTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2);

  const parts = [];
  if (h > 0) parts.push(`${h.toString().padStart(2, "0")} h`);
  if (m > 0 || h > 0) parts.push(`${m.toString().padStart(2, "0")} m`);
  parts.push(`${s.toString().padStart(2, "0")} s`);

  return parts.join(" ");
};

const formatSectorName = (mt_name: string): string => {
  const match = mt_name.match(/sector(\d+)/i);
  return match ? `Sector ${match[1]}` : mt_name;
};

const SectorTable: React.FC<Props> = ({ data }) => {
  return (
    <div className="container mt-4">
      <div className="table-responsive">
        <table className="table table-bordered table-hover text-center align-middle">
          <thead className="table-light">
            <tr>
              <th>Nombre</th>
              <th>Activo</th>
              <th>Tiempo Riego</th>
              <th>Totalizador m³</th>
            </tr>
          </thead>
          <tbody>
            {data.map((sector) => (
              <tr key={sector.mt_name}>
                <td>{formatSectorName(sector.mt_name)}</td>
                <td className="d-flex justify-content-center">
                  <StatusLed status={sector.is_active} />
                </td>
                <td>{formatIrrigationTime(sector.tiempo_riego_segundos)}</td>
                <td>{(sector.totalizador).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SectorTable;
