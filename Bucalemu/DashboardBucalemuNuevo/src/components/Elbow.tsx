import React, { type CSSProperties } from "react";

interface ElbowProps {
  spriteWidth: number;
  spriteHeight: number;
  a: number;
  b: number;
  image: string;
  style?: CSSProperties;
  displaySize?: number;
}

const Elbow: React.FC<ElbowProps> = ({
  spriteWidth,
  spriteHeight,
  a,
  b,
  image,
  style,
  displaySize = 200,
}) => {
  const elbowStyle: CSSProperties = {
    position: "absolute",
    width: displaySize,
    height: displaySize,
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
