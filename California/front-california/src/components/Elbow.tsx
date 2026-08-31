import React, { type CSSProperties } from "react";

interface ElbowProps {
  spriteWidth: number;
  spriteHeight: number;
  image: string;
  hasWaterFlow: boolean;
  style?: CSSProperties;
  freatico?: number;
  presion?: number;

  horometro?: number;

  totalizador?: number;
  caudal?: number;
  labelX?: number | string;
  labelY?: number | string;
}

const Elbow: React.FC<ElbowProps> = ({
  image,
  style,
  freatico,
  presion,
  horometro,
  totalizador,
  caudal,
  labelX = 150,
  labelY = 250,
}) => {
  const elbowStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    zIndex: 5,
    ...style,
  };

  const horHoras = Math.floor((horometro || 0) / 60);
  const horMinutos = Math.floor((horometro || 0) % 60);

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
        <div className="d-flex flex-column text-start">
          <h6 className="text-primary border-bottom pb-1">
            <strong>Bomba</strong>
          </h6>
          <div className="small mb-1">
            <span className="text-muted">Freático:</span>{" "}
            <strong>{(freatico ? freatico / 10 : 0).toFixed(2)} m</strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Caudal:</span>{" "}
            <strong>{(caudal || 0).toFixed(2)} l/s</strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Horómetro:</span>{" "}
            <strong>
              {horHoras} h {horMinutos} m
            </strong>
          </div>
          <div className="small mb-1">
            <span className="text-muted">Totalizador:</span>{" "}
            <strong>{((totalizador || 0) / 10).toFixed(2)} m³</strong>
          </div>
          <div className="small">
            <span className="text-muted">Presión:</span>{" "}
            <strong>{(presion || 0).toFixed(2)} psi</strong>
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
