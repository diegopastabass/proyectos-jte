import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Elbow from "./Elbow";
import State, { StateBody } from "./States";
import newTankImage from "../assets/newTank.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";
import lilTankImage from "../assets/lilTank.png";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  SALA_BOMBAS_NIVEL_METROS: Metric;
  SALA_BOMBAS_FUNCIONANDO: Metric;
  SALA_BOMBAS_COM_CERRO: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface ScadaDiagramProps {
  data: Datos;
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data }) => {
  const hasWaterFlow = data.snapshot.SALA_BOMBAS_FUNCIONANDO.value === 1;

  const imageAssets = {
    newTank: newTankImage,
    lilTank: lilTankImage,
    newPipe: newPipeImage,
    newElbow: newElbowImage,
    newPump: newPumpImage,
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    maxWidth: "1200px",
    height: "600px",
    borderRadius: "8px",
  };

  return (
    <div>
      <div style={containerStyle}>
        <State style={{ maxWidth: "250px", maxHeight: "180px" }}>
          <StateBody
            falla={data.snapshot.SALA_BOMBAS_COM_CERRO.value.toString()}
            bomba={data.snapshot.SALA_BOMBAS_FUNCIONANDO.value.toString()}
          ></StateBody>
        </State>
        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 300, left: -30 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: -30 }}
        />

        {/* 3. Tubería - Posición (300, 0) */}
        <Pipe
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={1}
          image={imageAssets.newPipe}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 270 }}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.SALA_BOMBAS_NIVEL_METROS.value}
          maxVolume={5}
          style={{ top: 0, left: 570 }}
          name="Estanque"
          labelOffsetX={35}
          tiempoVaciado={data.tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
