import React, { useState, useEffect, type CSSProperties } from "react";

interface TankProps {
  spriteWidth: number; // Ancho de un frame del sprite (e.g., 300)
  spriteHeight: number; // Alto de un frame del sprite (e.g., 300)
  positionX: number; // Posición X en el canvas original
  positionY: number; // Posición Y en el canvas original
  image: string; // URL de la imagen del sprite
  volume: number; // Volumen actual (para el nivel de agua)
  maxVolume: number; // Volumen máximo
  style?: CSSProperties;
  name?: string;
  labelOffsetX?: number;
  tiempoVaciado?: string;
}

const MAX_LEVEL_FRAMES = 20;
const FRAME_DELAY = 150;

const Tank: React.FC<TankProps> = ({
  spriteWidth,
  spriteHeight,
  positionX,
  positionY,
  image,
  volume,
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

  const safeVolume = Math.max(0, volume);
  const safeMaxVolume = Math.max(1, maxVolume);
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
          maxWidth: "300px",
          position: "relative",
          top: 130,
          left: 705,
          zIndex: 10,
        }}
      >
        <h5>{name}</h5>
        <h6>{volume.toFixed(2)} m</h6>
        <h6>{((500 / 11) * volume).toFixed(2)} m³</h6>
        <p>{Math.round(percentage * 100)}%</p>
        {tiempoVaciado && (
          <div className="alert alert-primary" style={{ padding: "5px" }}>
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
