import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Elbow from "./Elbow";
import Sentina from "./Sentina";
import State, { StateBody } from "./States";

import newTankImage from "../assets/newTank.png";
import lilTankImage from "../assets/lilTank.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";
import newSentinaImage from "../assets/sentina.png";

// Interfaces
interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado_pozo: number;
  tiempo_vaciado_formatted_pozo: string;
  tiempo_vaciado_sentina: number;
  tiempo_vaciado_formatted_sentina: string;
}

interface Datos {
  POZO: Pozo;
  SENTINA: Sentina;
}

interface Pozo {
  falla: Metric;
  freatico: Metric;
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  bomba: Metric;
}

interface Sentina {
  falla: Metric;
  freatico: Metric;
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  solar: Metric; // Dividir entre 1000
  bomba: Metric;
}

interface Metric {
  value: number;
  time: string;
}

interface ScadaDiagramProps {
  data: Snapshot;
  horPoz: string;
  horSen: string;
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  horPoz,
  horSen,
}) => {
  const hasWaterFlow = data.snapshot.POZO.bomba.value === 1;

  const imageAssets = {
    newTank: newTankImage,
    lilTank: lilTankImage,
    newPipe: newPipeImage,
    newElbow: newElbowImage,
    newPump: newPumpImage,
    newSentina: newSentinaImage,
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
        <State style={{ maxWidth: "250px", maxHeight: "180px" }}>
          <StateBody
            title="Tablero Estados Pozo"
            automatico={data.snapshot.POZO.automatico.value.toString()}
            falla={data.snapshot.POZO.falla.value.toString()}
            bomba={data.snapshot.POZO.bomba.value.toString()}
          ></StateBody>
        </State>
        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 300, left: 0 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 100 }}
          freatico={data.snapshot.POZO.freatico.value}
          horometro_diario={Number(horPoz)}
          horometro_total={data.snapshot.POZO.horometro.value}
        />

        {/* 3. Tubería - Posición (300, 0) */}
        <Pipe
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={1}
          image={imageAssets.newPipe}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 400 }}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.POZO.nivel.value}
          maxVolume={3.5}
          style={{ top: 0, left: 700 }}
          name="Estanque Pozo"
          labelOffsetX={35}
          tiempoVaciado={data.tiempo_vaciado_formatted_pozo}
        />

        {/* 5. Sentina - Posición (900, 0) */}
        <Sentina
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          image={imageAssets.newSentina}
          style={{ top: 0, left: 1000 }}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
