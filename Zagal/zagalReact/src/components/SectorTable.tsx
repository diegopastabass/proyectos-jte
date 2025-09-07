import React from "react";

interface SectorData {
  sector: string;
  estado: string; // "1" o "0"
  horometro?: number;
  volumen: number;
  caudal?: string;
}

interface Props {
  data: SectorData[];
}

const formatHorometro = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
};

const SectorTable: React.FC<Props> = ({ data }) => {
  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">Parcela 57 Agricola Zagal</h2>
      <table className="table table-bordered text-center align-middle">
        <thead className="table-light">
          <tr>
            <th>Sector</th>
            <th>Estado</th>
            <th>Horómetro</th>
            <th>Volumen (m³)</th>
            <th>Caudal (l/s)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((sector, index) => (
            <tr key={index}>
              <td>{sector.sector}</td>
              <td>
                <span
                  className={`d-inline-block rounded-circle`}
                  style={{
                    width: "16px",
                    height: "16px",
                    backgroundColor:
                      sector.estado === "1" ? "#198754" : "#6c757d",
                  }}
                ></span>
              </td>
              <td>{formatHorometro(sector.horometro ?? 0)}</td>
              <td>{sector.volumen}</td>
              <td>{sector.caudal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SectorTable;
