import React, { type CSSProperties } from "react";

interface ElbowProps {
  spriteWidth: number;
  spriteHeight: number;
  image: string;
  hasWaterFlow: boolean;
  style?: CSSProperties;
  freatico?: number;
  presion1?: number;
  presion2?: number;

  horometroPozo: number;

  totalizador1: number;
  totalizador2: number;
  totalizadorPozo: number;
  caudal1: number;
  caudal2: number;
  caudalPozo: number;
  labelX?: number | string;
  labelY?: number | string;
}

const Elbow: React.FC<ElbowProps> = ({
  image,
  style,
  freatico,
  presion1,
  presion2,
  horometroPozo,
  totalizador1,
  totalizador2,
  totalizadorPozo,
  caudal1,
  caudal2,
  caudalPozo,
  labelX = 300,
  labelY = 470,
}) => {
  const elbowStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    zIndex: 5,
    ...style,
  };

  const horHorasPozo = Math.floor((horometroPozo || 0) / 60);
  const horMinutosPozo = Math.floor((horometroPozo || 0) % 60);

  return (
    <div className="elbow-container">
      <div
        className="alert alert-light p-3 shadow-sm"
        style={{
          width: "max-content",
          position: "absolute",
          top: labelY,
          left: labelX,
          zIndex: 310,
          display: "flex",
          gap: "1.5rem",
        }}
      >
        {/* Sección Pozo */}
        <div className="d-flex flex-column text-start border-end pe-3">
          <h6 className="text-primary border-bottom pb-1">
            <strong>Pozo</strong>
          </h6>
          <div className="small mb-1">
            <span className="text-muted">Freático:</span>{" "}
            <strong>{(freatico ? freatico / 10 : 0).toFixed(2)} m</strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Caudal:</span>{" "}
            <strong>{(caudalPozo || 0).toFixed(2)} l/s</strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Horómetro:</span>{" "}
            <strong>
              {horHorasPozo} h {horMinutosPozo} m
            </strong>
          </div>
          <div className="small">
            <span className="text-muted">Totalizador:</span>{" "}
            <strong>{(totalizadorPozo || 0).toFixed(2)} m³</strong>
          </div>
        </div>

        {/* Sección Estanque 1 */}
        <div className="d-flex flex-column text-start border-end pe-3">
          <h6 className="text-success border-bottom pb-1">
            <strong>Estanque 1</strong>
          </h6>
          <div className="small mb-1">
            <span className="text-muted">Presión:</span>{" "}
            <strong>{(presion1 ? presion1 : 0).toFixed(2)} psi</strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Caudal:</span>{" "}
            <strong>{(caudal1 || 0).toFixed(2)} l/s</strong>
          </div>

          <div className="small">
            <span className="text-muted">Totalizador:</span>{" "}
            <strong>{(totalizador1 || 0).toFixed(2)} m³</strong>
          </div>
        </div>

        {/* Sección Estanque 2 */}
        <div className="d-flex flex-column text-start">
          <h6 className="text-info border-bottom pb-1">
            <strong>Estanque 2</strong>
          </h6>
          <div className="small mb-1">
            <span className="text-muted">Presión:</span>{" "}
            <strong>{(presion2 ? presion2 : 0).toFixed(2)} psi</strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Caudal:</span>{" "}
            <strong>{(caudal2 || 0).toFixed(2)} l/s</strong>
          </div>

          <div className="small">
            <span className="text-muted">Totalizador:</span>{" "}
            <strong>{(totalizador2 || 0).toFixed(2)} m³</strong>
          </div>
        </div>
      </div>
      <img
        src={image}
        alt="Pipe elbow"
        style={elbowStyle}
        className="border-0"
        width={300}
        height={300}
      />
    </div>
  );
};

export default Elbow;
