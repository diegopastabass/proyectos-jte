import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Elbow from "./Elbow";
import Sentina from "./Sentina";
import States from "./States";

import pozoTankImage from "../assets/newTank.png";
import sentinaTankImage from "../assets/newTank2.png";
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
  automatico: Metric;
  horometro: Metric;
  nivel: Metric;
  solar: Metric; // Dividir entre 1000
  bomba: Metric;
  AI23: Metric;
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
  const hasWaterFlowSentina = data.snapshot.SENTINA.bomba.value === 1;

  const imageAssets = {
    pozoTank: pozoTankImage,
    sentinaTank: sentinaTankImage,
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

  return (
    <div>
      <div style={containerStyle}>
        <States
          style={{
            maxWidth: "250px",
            maxHeight: "150px",
            marginBottom: "8px",
          }}
          title="Estado Tablero Pozo"
          automatico={data.snapshot.POZO.automatico.value.toString()}
          bomba={data.snapshot.POZO.bomba.value.toString()}
          falla={data.snapshot.POZO.falla.value.toString()}
        />
        <States
          style={{
            maxWidth: "250px",
            maxHeight: "120px",
            marginBottom: "8px",
          }}
          title="Estado Tablero Sentina"
          automatico={data.snapshot.SENTINA.automatico.value.toString()}
          bomba={data.snapshot.SENTINA.bomba.value.toString()}
        />

        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 340, left: -260 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 40, left: -260 }}
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
          style={{ top: 40, left: 40 }}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.pozoTank}
          volume={data.snapshot.POZO.nivel.value}
          maxVolume={3.5}
          style={{ top: 40, left: 340 }}
          name="Estanque Pozo"
          labelX={400}
          labelY={50}
          tiempoVaciado={data.tiempo_vaciado_formatted_pozo}
        />

        {/* 5. Sentina - Posición (900, 0) */}
        <Sentina
          image={imageAssets.newSentina}
          style={{ top: 40, left: 640 }}
          isActive={hasWaterFlowSentina}
          horometro_diario={Number(horSen)}
          horometro_total={data.snapshot.SENTINA.horometro.value}
          AI23={data.snapshot.SENTINA.AI23.value / 100}
        />

        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.sentinaTank}
          volume={data.snapshot.SENTINA.nivel.value / 100}
          maxVolume={2.2}
          style={{ top: -10.6, left: 940 }}
          name="Estanque Cerro"
          labelX={990}
          labelY={-200}
          tiempoVaciado={data.tiempo_vaciado_formatted_sentina}
          solar={data.snapshot.SENTINA.solar.value / 1000}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
