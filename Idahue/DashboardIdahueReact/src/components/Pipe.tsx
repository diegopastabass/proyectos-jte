import React, { useState, useEffect, type CSSProperties } from "react";

interface PipeProps {
  spriteWidth: number;
  spriteHeight: number;
  sentido: number;
  image: string;
  hasWaterFlow: boolean;
  style?: CSSProperties;
}

const FRAMES_COUNT = 3;
const FRAME_DELAY = 100;

const Pipe: React.FC<PipeProps> = ({
  spriteWidth,
  spriteHeight,
  sentido,
  image,
  hasWaterFlow,
  style,
}) => {
  const [frameX, setFrameX] = useState(0);

  useEffect(() => {
    if (hasWaterFlow) {
      const interval = setInterval(() => {
        setFrameX((prevFrameX) => (prevFrameX + 1) % FRAMES_COUNT);
      }, FRAME_DELAY);

      return () => clearInterval(interval);
    } else {
      setFrameX(0);
    }
  }, [hasWaterFlow]);

  const pipeStyle: CSSProperties = {
    position: "absolute",
    width: 300,
    height: 300,
    objectFit: "none",
    objectPosition: `-${frameX * spriteWidth}px -${sentido * spriteHeight}px`,
    ...style,
  };

  return (
    <div className="pipe-container">
      <img
        src={image}
        alt="Pipe with water flow"
        style={pipeStyle}
        width={300}
        height={300}
      />
    </div>
  );
};

export default Pipe;
