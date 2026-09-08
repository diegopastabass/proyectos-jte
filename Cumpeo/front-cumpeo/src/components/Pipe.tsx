import React, { useState, useEffect, type CSSProperties } from "react";

interface PipeProps {
  spriteWidth: number;
  spriteHeight: number;
  sentido: number;
  image: string;
  hasWaterFlow: boolean;
  style?: CSSProperties;
  caudal_pozo2?: number;
  caudal_pozo1?: number;
  totalizador_total?: number;
  totalizador_diario?: number;
  titleTotalizador?: string;
  titleCaudal?: string;
}

const FRAMES_COUNT = 3;
const FRAME_DELAY = 100;

const Pipe: React.FC<PipeProps> = ({
  spriteWidth,
  spriteHeight,
  sentido,
  image,
  hasWaterFlow,
  style,
  caudal_pozo1,
  caudal_pozo2,
  totalizador_diario,
  totalizador_total,
  titleTotalizador,
  titleCaudal,
}) => {
  const [frameX, setFrameX] = useState(0);

  useEffect(() => {
    if (hasWaterFlow) {
      const interval = setInterval(() => {
        setFrameX((prevFrameX) => (prevFrameX + 1) % FRAMES_COUNT);
      }, FRAME_DELAY);

      return () => clearInterval(interval);
    } else {
      setFrameX(0);
    }
  }, [hasWaterFlow]);

  const pipeStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${sentido * spriteHeight}px`,
    ...style,
  };

  return (
    <div className="pipe-container">
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 320,
          zIndex: 10,
          display: "flex",
          gap: "15px",
        }}
      >
        <div
          className="text-center alert alert-light m-0 p-2"
          style={{ minWidth: "160px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}
        >
          {titleTotalizador && (
            <h6 className="mb-2 text-primary">{titleTotalizador}</h6>
          )}
          <div className="mb-2">
            <span className="text-muted small">Totalizador:</span>
            <strong>
              <h6>
                {totalizador_diario ? totalizador_diario?.toFixed(2) : 0} m³
              </h6>
            </strong>
          </div>
          <div className="mb-0">
            <span className="text-muted small">Totalizador Total:</span>
            <strong>
              <h6>
                {totalizador_total ? totalizador_total?.toFixed(2) : 0} m³
              </h6>
            </strong>
          </div>
          <div className="mb-0">
            <span className="text-muted small">Caudal de Impulsión:</span>
            <strong>
              <h6>{caudal_pozo1 ? caudal_pozo1?.toFixed(2) : 0} l/s</h6>
            </strong>
          </div>
        </div>

        <div
          className="text-center alert alert-light m-0 p-2"
          style={{
            maxHeight: "100px",
            maxWidth: "160px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
          }}
        >
          {titleCaudal && <h6 className="mb-2 text-primary">{titleCaudal}</h6>}
          <div className="mb-0">
            <span className="text-muted small">Caudal de Impulsión:</span>
            <strong>
              <h6>{caudal_pozo2 ? caudal_pozo2?.toFixed(2) : 0} l/s</h6>
            </strong>
          </div>
        </div>
      </div>
      <img
        src={image}
        alt="Pipe with water flow"
        style={pipeStyle}
        width={300}
        height={300}
      />
    </div>
  );
};

export default Pipe;
