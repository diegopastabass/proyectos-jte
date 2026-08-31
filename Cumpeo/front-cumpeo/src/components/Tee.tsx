import React, { type CSSProperties } from "react";

interface TeeProps {
  spriteWidth: number;
  spriteHeight: number;
  image: string;
  style?: CSSProperties;
  /** Caudal del pozo 2 en l/s (ya dividido) */
  caudal?: number;
  /** Posición vertical de la label relativa al contenedor */
  labelY?: number;
  /** Posición horizontal de la label relativa al contenedor */
  labelX?: number;
}

const Tee: React.FC<TeeProps> = ({
  spriteWidth,
  spriteHeight,
  image,
  style,
  caudal,
  labelY = 0,
  labelX = 0,
}) => {
  const teeStyle: CSSProperties = {
    position: "absolute",
    width: spriteWidth,
    height: spriteHeight,
    objectFit: "none",
    objectPosition: "0px 0px",
    ...style,
  };

  return (
    <div className="tee-container">
      {caudal && (
        <div
          className="text-center alert alert-light"
          style={{
            maxWidth: "200px",
            position: "absolute",
            top: labelY,
            left: labelX,
            zIndex: 10,
          }}
        >
          <div className="mb-0">
            <span className="text-muted small">Caudal San Enrique 3:</span>
            <strong>
              <h6>{caudal?.toFixed(2) ?? 0} l/s</h6>
            </strong>
          </div>
        </div>
      )}
      <img
        src={image}
        alt="Tee pipe junction"
        style={teeStyle}
        width={spriteWidth}
        height={spriteHeight}
      />
    </div>
  );
};

export default Tee;
