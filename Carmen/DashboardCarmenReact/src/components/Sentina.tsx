import React, { type CSSProperties } from "react";

interface SentinaProps {
  spriteWidth: number;
  spriteHeight: number;
  image: string;
  style?: CSSProperties;
}

const Sentina: React.FC<SentinaProps> = ({
  spriteWidth,
  spriteHeight,
  image,
  style,
}) => {
  const sentinaStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${spriteWidth}px -${spriteHeight}px`,
    ...style,
  };

  return (
    <div className="pump-container">
      <img
        src={image}
        alt="Pump status"
        style={sentinaStyle}
        className="border-0"
        width={300}
        height={300}
      />
    </div>
  );
};

export default Sentina;
