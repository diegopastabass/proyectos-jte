import React, { type CSSProperties } from "react";

interface ElbowProps {
  spriteWidth: number;
  spriteHeight: number;
  a: number;
  b: number;
  image: string;
  style?: CSSProperties;
}

const Elbow: React.FC<ElbowProps> = ({
  spriteWidth,
  spriteHeight,
  a,
  b,
  image,
  style,
}) => {
  const elbowStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${a * spriteWidth}px -${b * spriteHeight}px`,
    ...style,
  };

  return (
    <div className="elbow-container">
      <img
        src={image}
        alt="Pipe elbow"
        style={elbowStyle}
        className="border-0"
        width={300}
        height={300}
      />
    </div>
  );
};

export default Elbow;
