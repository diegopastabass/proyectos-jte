import React, { useState, useEffect, type CSSProperties } from "react";

interface TankProps {
  spriteWidth: number;
  spriteHeight: number;
  positionX: number;
  positionY: number;
  image: string;
  volume: number;
  maxVolume: number;
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

  // Estilo del contenedor principal: controla la posición absoluta
  const containerStyle: CSSProperties = {
    position: "absolute",
    left: positionX,
    top: positionY,
    width: spriteWidth,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    ...style,
  };

  // Estilo de la imagen (sprite)
  const imageStyle: CSSProperties = {
    width: spriteWidth,
    height: spriteHeight,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${frameY * spriteHeight}px`,
  };

  return (
    <div style={containerStyle}>
      {/* Imagen del Tanque */}
      <img
        src={image}
        alt="Tank animation"
        style={imageStyle}
        width={spriteWidth}
        height={spriteHeight}
      />

      {/* Información del Tanque */}
      <div className="text-center" style={{ marginTop: "10px", width: "100%" }}>
        <h5>{name}</h5>
        <h6>{volume.toFixed(2)} m</h6>
        <h6>{((60 / 7) * volume).toFixed(2)} m³</h6>
        <p>{Math.round(percentage * 100)}%</p>

        {tiempoVaciado && (
          <div
            className="alert alert-primary"
            style={{ padding: "5px", fontSize: "0.9rem" }}
          >
            <strong>Tiempo Vaciado:</strong>
            <div>{tiempoVaciado}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tank;
