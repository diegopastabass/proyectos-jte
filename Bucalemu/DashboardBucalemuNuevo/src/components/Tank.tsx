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
  tiempoVaciado?: string;
  time?: string;
  displaySize?: number; // Nueva prop para tamaño de renderizado
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
  time,
  maxVolume,
  style,
  name,
  tiempoVaciado,
  displaySize = 200, // Valor por defecto visual
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

  // Factor de escala (ej: 200 / 300 = 0.66)
  const scale = displaySize / spriteWidth;

  // Contenedor principal: Usa el tamaño visual (displaySize) para el layout
  const containerStyle: CSSProperties = {
    position: "absolute",
    left: positionX,
    top: positionY,
    width: displaySize,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    ...style,
  };

  // Wrapper para la imagen: Mantiene el espacio reservado del tamaño reducido
  const imageWrapperStyle: CSSProperties = {
    width: displaySize,
    height: displaySize,
    position: "relative",
    overflow: "hidden", // Asegura que no se desborde nada
  };

  // Imagen: Mantiene tamaño original para el sprite, pero se escala visualmente
  const imageStyle: CSSProperties = {
    width: spriteWidth,
    height: spriteHeight,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${frameY * spriteHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: "top left", // Escalar desde la esquina superior izquierda
    position: "absolute",
    top: 0,
    left: 0,
  };

  let timeDiffMinutes: number | null = null;
  let formattedDate: string = "";

  if (time) {
    const timestamp = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    timeDiffMinutes = Math.floor(diffMs / 60000);
    formattedDate = timestamp.toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  let freshnessClass = "";
  if (timeDiffMinutes !== null) {
    if (timeDiffMinutes <= 10) {
      freshnessClass = "bg-success text-white";
    } else if (timeDiffMinutes <= 20) {
      freshnessClass = "bg-warning text-dark";
    } else {
      freshnessClass = "bg-danger text-white";
    }
  }

  return (
    <div style={containerStyle}>
      <div className="d-flex align-items-center gap-2 flex-grow-1">
        <div className="d-flex flex-column align-items-center text-lg-start">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>
      </div>
      <div style={imageWrapperStyle}>
        <img
          src={image}
          alt="Tank animation"
          style={imageStyle}
          width={spriteWidth}
          height={spriteHeight}
        />
      </div>

      <div className="text-center" style={{ marginTop: "5px", width: "100%" }}>
        <h5 style={{ fontSize: "1rem" }}>{name}</h5>
        <h6 style={{ fontSize: "0.9rem" }}>{volume.toFixed(2)} m</h6>
        <h6 style={{ fontSize: "0.9rem" }}>
          {((60 / 7) * volume).toFixed(2)} m³
        </h6>
        <p style={{ fontSize: "0.9rem", margin: 0 }}>
          {Math.round(percentage * 100)}%
        </p>

        {tiempoVaciado && (
          <div
            className="alert alert-primary"
            style={{ padding: "2px", fontSize: "0.8rem", marginTop: "5px" }}
          >
            <strong>T. Vaciado:</strong>
            <div>{tiempoVaciado}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tank;
