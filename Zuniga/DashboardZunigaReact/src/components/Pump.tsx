import React, { type CSSProperties } from "react";

interface PumpProps {
  spriteWidth: number;
  spriteHeight: number;
  sentido: number;
  image: string;
  isActive: boolean;
  style?: CSSProperties;
}

const Pump: React.FC<PumpProps> = ({
  spriteWidth,
  spriteHeight,
  sentido,
  image,
  isActive,
  style,
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
      <div
        className="text-center alert alert-light "
        style={{
          maxWidth: "270px",
          position: "absolute",
          top: 500,
          left: 250,
          zIndex: 10,
        }}
      ></div>
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
