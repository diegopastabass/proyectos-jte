import React, { useState, useEffect, type CSSProperties } from "react";

interface TankProps {
  spriteWidth: number; // Ancho de un frame del sprite (e.g., 300)
  spriteHeight: number; // Alto de un frame del sprite (e.g., 300)
  positionX: number; // Posición X en el canvas original
  positionY: number; // Posición Y en el canvas original
  image: string; // URL de la imagen del sprite
  level: number; // Nivel actual (para el nivel de agua)
  maxLevel: number; // Nivel máximo
  maxVolume: number;
  style?: CSSProperties;
  name?: string;
  labelX?: number;
  labelY?: number;
  tiempoVaciado?: string;
}

const MAX_LEVEL_FRAMES = 20;
const FRAME_DELAY = 150;

const Tank: React.FC<TankProps> = ({
  spriteWidth,
  spriteHeight,
  positionX,
  positionY,
  labelX,
  labelY,
  image,
  level,
  maxLevel,
  maxVolume,
  style,
  name,
  tiempoVaciado,
}) => {
  const [frameX, setFrameX] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameX((prevFrameX) => (prevFrameX > 0 ? 0 : prevFrameX + 1));
    }, FRAME_DELAY);

    return () => clearInterval(interval);
  }, []);

  const safeVolume = Math.max(0, level);
  const safeMaxVolume = Math.max(1, maxLevel);
  const percentage = safeVolume / safeMaxVolume;
  let frameY = Math.floor(percentage * MAX_LEVEL_FRAMES);
  frameY = Math.min(Math.max(frameY, 0), MAX_LEVEL_FRAMES);

  const tankStyle: CSSProperties = {
    position: "absolute",
    left: positionX,
    top: positionY,
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${frameY * spriteHeight}px`,
    ...style,
  };

  return (
    <div className="tank-container">
      <div
        className="text-center"
        style={{
          maxWidth: "250px",
          position: "relative",
          top: labelY,
          left: labelX,
          zIndex: 10,
        }}
      >
        <h5>{name}</h5>
        <h6>{((maxVolume / 100) * level).toFixed(2)} m³</h6>
        <p>{Math.round(percentage * 100)}%</p>
        {tiempoVaciado && (
          <div
            className="alert alert-primary"
            style={{ padding: "5px", margin: "5px" }}
          >
            <h6>Tiempo de Vaciado Estanque</h6>
            <p>{tiempoVaciado}</p>
          </div>
        )}
      </div>
      <img
        src={image}
        alt="Tank animation"
        style={tankStyle}
        width={300}
        height={300}
      />
    </div>
  );
};

export default Tank;
