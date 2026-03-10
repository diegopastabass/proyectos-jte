import React, { type CSSProperties } from "react";

// Props originales mantenidas
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
  displaySize?: number;
}

// Componente principal
const Tank: React.FC<TankProps> = ({
  positionX,
  positionY,
  volume,
  time,
  maxVolume,
  style,
  name,
  tiempoVaciado,
  displaySize = 200,
}) => {
  const safeVolume = Math.max(0, volume);
  const safeMaxVolume = Math.max(1, maxVolume);
  const percentage = safeVolume / safeMaxVolume;

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

      <div
        style={{
          position: "relative",
          width: displaySize * 0.6,
          height: displaySize * 0.8,
          marginTop: "10px",
          border: "4px solid #4a5568",
          borderRadius: "10px 10px 15px 15px",
          overflow: "hidden",
          backgroundColor: "#edf2f7",
        }}
      >
        <style>{`
          @keyframes liquidWave {
            0% { transform: translateX(-50%) rotate(0deg); }
            100% { transform: translateX(-50%) rotate(360deg); }
          }
        `}</style>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: `${percentage * 100}%`,
            backgroundColor: "#3182ce",
            transition: "height 0.8s ease-in-out",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-290px",
              left: "50%",
              width: "300px",
              height: "300px",
              backgroundColor: "#edf2f7",
              borderRadius: "40%",
              animation: "liquidWave 4s linear infinite",
            }}
          />
        </div>
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
