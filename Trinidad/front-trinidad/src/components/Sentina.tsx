import React, { type CSSProperties } from "react";

interface SentinaProps {
  /** Ancho de un frame del sprite en px (300) */
  spriteWidth: number;
  /** Alto de un frame del sprite en px (300) */
  spriteHeight: number;
  /** Imagen del sprite sheet de sentina */
  image: string;
  /** Estado de la bomba elevadora 1 (0 = apagada, 1 = encendida) */
  be1: number;
  /** Estado de la bomba elevadora 2 (0 = apagada, 1 = encendida) */
  be2: number;
  /** Estilos adicionales para posicionar el componente en el diagrama SCADA */
  style?: CSSProperties;
}

/**
 * Componente Sentina — renderiza el sprite correcto según el estado
 * de las dos bombas elevadoras (be1 y be2).
 *
 * Mapeo de frames (col × row):
 *   be1=0 be2=0 → col 0, row 0  (ambas apagadas)
 *   be1=1 be2=1 → col 1, row 0  (ambas encendidas)
 *   be1=1 be2=0 → col 0, row 1  (solo B1 encendida)
 *   be1=0 be2=1 → col 1, row 1  (solo B2 encendida)
 */
const Sentina: React.FC<SentinaProps> = ({
  spriteWidth,
  spriteHeight,
  image,
  be1,
  be2,
  style,
}) => {
  // Determinar columna y fila del sprite según el estado de las bombas
  let col: number;
  let row: number;

  if (be1 === 0 && be2 === 0) {
    col = 0;
    row = 0;
  } else if (be1 === 1 && be2 === 1) {
    col = 1;
    row = 0;
  } else if (be1 === 1 && be2 === 0) {
    col = 0;
    row = 1;
  } else {
    // be1=0, be2=1
    col = 1;
    row = 1;
  }

  const sentinaStyle: CSSProperties = {
    position: "absolute",
    width: spriteWidth,
    height: spriteHeight,
    backgroundImage: `url(${image})`,
    backgroundSize: `${spriteWidth * 2}px ${spriteHeight * 2}px`,
    backgroundPosition: `-${col * spriteWidth + 1}px -${row * spriteHeight + 1}px`,
    backgroundRepeat: "no-repeat",
    ...style,
  };

  return (
    <div
      className="sentina-container"
      style={sentinaStyle}
      title={`Sentina — B1: ${be1 === 1 ? "ON" : "OFF"} / B2: ${be2 === 1 ? "ON" : "OFF"}`}
    />
  );
};

export default Sentina;
