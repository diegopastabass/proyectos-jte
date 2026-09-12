import React, { type CSSProperties } from "react";

interface PumpProps {
  spriteWidth: number;
  spriteHeight: number;
  sentido: number;
  image: string;
  isActive: boolean;
  style?: CSSProperties;
  caudal?: number;
}

const Pump: React.FC<PumpProps> = ({
  spriteWidth,
  spriteHeight,
  sentido,
  image,
  isActive,
  style,
  caudal,
}) => {
  const frameX = isActive ? 1 : 0;

  const pumpStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${sentido * spriteHeight}px`,
    ...style,
  };

  return (
    <div className="pump-container">
      {caudal !== undefined && (
        <div
          className="text-center alert alert-light "
          style={{
            maxWidth: "270px",
            position: "absolute",
            top: 450,
            left: 150,
            zIndex: 10,
          }}
        >
          <div className="mb-0">
            <span className="text-muted small">Caudal:</span>
            <strong>
              <h6>{caudal.toFixed(2)} l/s</h6>
            </strong>
          </div>
        </div>
      )}
      <img
        src={image}
        alt="Pump status"
        style={pumpStyle}
        className="border-0"
        width={300}
        height={300}
      />
    </div>
  );
};

export default Pump;
