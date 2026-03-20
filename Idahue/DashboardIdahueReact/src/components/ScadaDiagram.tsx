import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pump from "./Pump";
import Elbow from "./Elbow";
import States from "./States";

import TankImage from "../assets/newTank2.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";
import newSentinaImage from "../assets/sentina.png";

interface Metric {
  value: number;
  time: string;
}

interface ScadaDiagramProps {
  automatico: Metric;
  horometro: number;
  nivel: Metric;
  solar?: number;
  bomba: Metric;
  name: string;
  tiempo_vaciado_formatted: string;
  nivel_max: number;
  divisor_nivel: number;
  horometro_diario: number;
  date?: string;
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  automatico,
  horometro,
  horometro_diario,
  nivel,
  solar,
  bomba,
  tiempo_vaciado_formatted,
  name,
  nivel_max,
  divisor_nivel,
  date,
}) => {
  const hasWaterFlow = bomba.value === 1;

  const imageAssets = {
    pozoTank: TankImage,
    newPipe: newPipeImage,
    newElbow: newElbowImage,
    newPump: newPumpImage,
    newSentina: newSentinaImage,
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    maxWidth: "1200px",
    height: "600px",
    borderRadius: "8px",
  };

  let timeDiffMinutes = null;
  let formattedDate = "Desconocida";

  if (date) {
    const timestamp = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    timeDiffMinutes = Math.floor(diffMs / 60000);

    const day = String(timestamp.getDate()).padStart(2, "0");
    const month = String(timestamp.getMonth() + 1).padStart(2, "0");
    const hours = String(timestamp.getHours()).padStart(2, "0");
    const minutes = String(timestamp.getMinutes()).padStart(2, "0");

    formattedDate = `${day}-${month} ${hours}:${minutes}`;
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
    <div>
      <div style={containerStyle}>
        <div className="d-flex flex-column align-items-center text-lg-start flex-grow-1 order-2 order-lg-0 mb-2">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>
        <States
          style={{
            maxWidth: "250px",
            maxHeight: "120px",
            marginBottom: "8px",
          }}
          title={`Estado Tablero ${name}`}
          automatico={automatico.value.toString()}
          bomba={bomba.value.toString()}
        />

        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 340, left: 0 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 40, left: 0 }}
          horometro_diario={horometro_diario}
          horometro_total={horometro}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.pozoTank}
          volume={nivel.value / divisor_nivel}
          maxVolume={nivel_max}
          style={{ top: 40, left: 300 }}
          name={`Estanque ${name}`}
          labelX={350}
          labelY={180}
          solar={solar}
          tiempoVaciado={tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
