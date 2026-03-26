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

  horometro_total: number;
  horometro_diario: number;
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
}) => {
  const elbowStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${a * spriteWidth}px -${b * spriteHeight}px`,
    ...style,
  };

  const horHoras = Math.floor(horometro_diario / 60);
  const horMinutos = horometro_diario % 60;

  const horHorasT = Math.floor(horometro_total / 60);
  const horMinutosT = horometro_total % 60;

  return (
    <div className="elbow-container">
      <div
        className="text-center alert alert-light "
        style={{
          maxWidth: "300px",
          position: "absolute",
          top: 320,
          left: 400,
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
