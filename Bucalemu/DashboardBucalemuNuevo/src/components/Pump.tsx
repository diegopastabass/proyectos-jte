import React, { type CSSProperties } from "react";

interface PumpProps {
  spriteWidth: number;
  spriteHeight: number;
  sentido: number;
  image: string;
  isActive: boolean;
  style?: CSSProperties;
  displaySize?: number;
}

const Pump: React.FC<PumpProps> = ({
  spriteWidth,
  spriteHeight,
  sentido,
  image,
  isActive,
  style,
  displaySize = 200,
}) => {
  const frameX = isActive ? 1 : 0;
  const scale = displaySize / spriteWidth;

  // Contenedor principal con overflow hidden para recortar el sprite
  const containerStyle: CSSProperties = {
    position: "absolute",
    width: displaySize,
    height: displaySize,
    overflow: "hidden",
    ...style,
  };

  // Imagen escalada
  const imgStyle: CSSProperties = {
    width: spriteWidth,
    height: spriteHeight,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${sentido * spriteHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    position: "absolute",
    top: 0,
    left: 0,
  };

  return (
    <div style={containerStyle}>
      <img
        src={image}
        alt="Pump status"
        style={imgStyle}
        width={spriteWidth}
        height={spriteHeight}
      />
    </div>
  );
};

export default Pump;
