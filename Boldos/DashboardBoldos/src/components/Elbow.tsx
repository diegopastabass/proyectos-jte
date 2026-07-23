import React, { type CSSProperties } from "react";

interface ElbowProps {
  spriteWidth: number;
  spriteHeight: number;
  a: number;
  b: number;
  image: string;
  hasWaterFlow: boolean;
  style?: CSSProperties;
  freatico?: number;
  presion?: number;

  horometro_total?: number;
  horometro_diario?: number;
  totalizador_diario?: number;
  totalizador_total?: number;
  caudal?: number;
}

const Elbow: React.FC<ElbowProps> = ({
  spriteWidth,
  spriteHeight,
  a,
  b,
  image,
  style,
  freatico,
  horometro_diario,
  horometro_total,
  totalizador_diario,
  totalizador_total,
  caudal,
}) => {
  const elbowStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${a * spriteWidth}px -${b * spriteHeight}px`,
    ...style,
  };

  const horHoras =
    horometro_diario !== undefined ? Math.floor(horometro_diario / 60) : 0;
  const horMinutos = horometro_diario !== undefined ? horometro_diario % 60 : 0;

  const horHorasT =
    horometro_total !== undefined ? Math.floor(horometro_total / 60) : 0;
  const horMinutosT = horometro_total !== undefined ? horometro_total % 60 : 0;

  const showLabels =
    freatico !== undefined ||
    horometro_diario !== undefined ||
    horometro_total !== undefined ||
    totalizador_diario !== undefined ||
    totalizador_total !== undefined ||
    caudal !== undefined;

  return (
    <div className="elbow-container">
      {showLabels && (
        <div
          className="text-center alert alert-light "
          style={{
            width: "250px",
            position: "absolute",
            top: 220,
            left: 0,
            zIndex: 10,
          }}
        >
          <div className="mb-2">
            <span className="text-muted small">Freático:</span>{" "}
            <strong>
              <h6>{(freatico ? freatico / 100 : 0).toFixed(2)} m</h6>
            </strong>
          </div>
          <div className="mb-2">
            <span className="text-muted small">Horómetro Por Día:</span>{" "}
            <strong>
              <h6>
                {horHoras} h {horMinutos} m
              </h6>
            </strong>
          </div>
          <div className="mb-2">
            <span className="text-muted small">Horómetro:</span>{" "}
            <strong>
              <h6>
                {horHorasT} h {horMinutosT} m
              </h6>
            </strong>
          </div>
          <div className="mb-2">
            <span className="text-muted small">Totalizador Por Día:</span>
            <strong>
              <h6>
                {totalizador_diario ? totalizador_diario?.toFixed(2) : 0} m³
              </h6>
            </strong>
          </div>
          <div className="mb-2">
            <span className="text-muted small">Totalizador:</span>
            <strong>
              <h6>
                {totalizador_total ? totalizador_total?.toFixed(2) : 0} m³
              </h6>
            </strong>
          </div>
          <div className="mb-2">
            <span className="text-muted small">Caudal de Impulsión:</span>
            <strong>
              <h6>{caudal ? caudal?.toFixed(2) : 0} l/s</h6>
            </strong>
          </div>
        </div>
      )}
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
