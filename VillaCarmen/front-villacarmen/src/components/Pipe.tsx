import React, { useState, useEffect, type CSSProperties } from "react";

interface PipeProps {
  spriteWidth: number;
  spriteHeight: number;
  sentido: number;
  image: string;
  hasWaterFlow: boolean;
  style?: CSSProperties;
  caudal?: number;
  totalizador_total?: number;
  totalizador_diario?: number;
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
  caudal,
  totalizador_diario,
  totalizador_total,
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
        className="text-center alert alert-light "
        style={{
          maxWidth: "220px",
          position: "absolute",
          top: 80,
          left: 320,
          zIndex: 10,
        }}
      >
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
            <h6>{totalizador_total ? totalizador_total?.toFixed(2) : 0} m³</h6>
          </strong>
        </div>
        <div className="mb-2">
          <span className="text-muted small">Caudal de Impulsión:</span>
          <strong>
            <h6>{caudal ? caudal?.toFixed(2) : 0} l/s</h6>
          </strong>
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
