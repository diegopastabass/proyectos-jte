import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Elbow from "./Elbow";
import States from "./States";
import tankImage from "../assets/newTank.png";
import pipeImage from "../assets/newPipe.png";
import elbowImage from "../assets/newElbow.png";
import pumpImage from "../assets/newPump.png";

interface Snapshot {
  snapshot: DatosSnapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface DatosSnapshot {
  automatico: Metric;
  nivel: Metric;
  solar: Metric;
  bomba: Metric;
  horometro: Metric;
}

interface Metric {
  value: number;
  time: string;
}

interface ScadaDiagramProps {
  data: Snapshot;
  hor: string;
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data, hor }) => {
  const hasWaterFlow = data.snapshot.bomba.value === 1;

  const nivelMaxEstanque = 4;

  const imageAssets = {
    newTank: tankImage,
    newPipe: pipeImage,
    newElbow: elbowImage,
    newPump: pumpImage,
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    maxWidth: "900px",
    height: "600px",
    borderRadius: "8px",
  };

  return (
    <div>
      <div style={containerStyle}>
        <States
          style={{
            maxWidth: "250px",
            maxHeight: "150px",
            marginBottom: "8px",
          }}
          title="Estado Tablero"
          automatico={data.snapshot.automatico.value.toString()}
          bomba={data.snapshot.bomba.value.toString()}
        />

        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 300, left: 5 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 5 }}
          horometro_diario={Number(hor)}
          horometro_total={data.snapshot.horometro.value}
        />

        {/* 3. Tubería - Posición (300, 0) */}
        <Pipe
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={1}
          image={imageAssets.newPipe}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 305 }}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.nivel.value / 100}
          maxVolume={nivelMaxEstanque}
          style={{ top: 0, left: 605 }}
          name="Estanque 1"
          labelX={600}
          labelY={120}
          solar={data.snapshot.solar.value / 1000}
          tiempoVaciado={data.tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
