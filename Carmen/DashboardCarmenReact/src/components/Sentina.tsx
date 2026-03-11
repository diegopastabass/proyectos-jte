import React, { type CSSProperties } from "react";

interface SentinaProps {
  image: string;
  style?: CSSProperties;
  isActive: boolean;
  horometro_total: number;
  horometro_diario: number;
  AI23: number;
}

const Sentina: React.FC<SentinaProps> = ({
  image,
  style,
  isActive,
  horometro_total,
  horometro_diario,
  AI23,
}) => {
  const frameX = isActive ? 1 : 0;
  const sentinaStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${frameX * 300}px -50.6px`,
    ...style,
  };

  const horHoras = Math.floor(horometro_diario / 60);
  const horMinutos = horometro_diario % 60;

  const horHorasT = Math.floor(horometro_total / 60);
  const horMinutosT = horometro_total % 60;

  return (
    <div className="pump-container">
      <div
        className="text-center alert alert-light "
        style={{
          maxWidth: "300px",
          position: "absolute",
          top: 300,
          left: 720,
          zIndex: 10,
        }}
      >
        <div className="mb-2">
          <span className="text-muted small">Horómetro:</span>{" "}
          <strong>
            <h6>
              {horHoras} h {horMinutos} m
            </h6>
          </strong>
        </div>

        <div className="mb-2">
          <span className="text-muted small">Horómetro Total:</span>{" "}
          <strong>
            <h6>
              {horHorasT} h {horMinutosT} m
            </h6>
          </strong>
        </div>

        <div className="mb-2">
          <span className="text-muted small">Presión:</span>{" "}
          <strong>
            <h6>{AI23} Bar</h6>
          </strong>
        </div>
      </div>
      <img
        src={image}
        alt="Pump status"
        style={sentinaStyle}
        className="border-0"
        width={300}
        height={300}
      />
    </div>
  );
};

export default Sentina;
