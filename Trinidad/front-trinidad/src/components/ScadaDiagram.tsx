import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Sentina from "./Sentina";
import newTankImage from "../assets/newTank.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";
import lilTankImage from "../assets/lilTank.png";
import sentinaImage from "../assets/sentina.png";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  bomba_pozo: Metric;
  bomba_elevadora_1: Metric;
  bomba_elevadora_2: Metric;
  totalizador_pozo: Metric;
  caudal_pozo: Metric;
  freatico: Metric;
  totalizador_sentina: Metric;
  horometro_bomba_pozo: Metric;
  horometro_elevadora_1: Metric;
  horometro_elevadora_2: Metric;
  estanque: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}
interface ScadaDiagramProps {
  data: Datos;
  horometroPozo: Metric[];
  horometroElevadora1: Metric[];
  horometroElevadora2: Metric[];
  totalizadorPozo: Metric[];
  totalizadorSentina: Metric[];
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  totalizadorSentina,
}) => {
  const hasWaterFlowPozo = data.snapshot.bomba_pozo.value === 1;
  const hasWaterFlow =
    data.snapshot.bomba_elevadora_1.value === 1 ||
    data.snapshot.bomba_elevadora_2.value === 1;

  const latestTotalizadorSentina =
    totalizadorSentina.length > 0
      ? totalizadorSentina[totalizadorSentina.length - 1].value
      : 0;

  const imageAssets = {
    sentina: sentinaImage,
    newTank: newTankImage,
    lilTank: lilTankImage,
    newPipe: newPipeImage,
    newElbow: newElbowImage,
    newPump: newPumpImage,
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    maxWidth: "1200px",
    height: "630px",
    borderRadius: "8px",
  };

  return (
    <div>
      <div style={containerStyle}>
        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlowPozo}
          style={{ top: 400, left: -148 }}
          caudal={data.snapshot.caudal_pozo.value}
        />
        {/* Sentina - Posición ajustable con la prop style */}
        <Sentina
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          image={imageAssets.sentina}
          be1={data.snapshot.bomba_elevadora_1.value}
          be2={data.snapshot.bomba_elevadora_2.value}
          style={{ top: 100 + 1, left: 100 + 1 }}
        />

        {/* 3. Tubería - Posición (300, 0) */}
        <Pipe
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={1}
          image={imageAssets.newPipe}
          hasWaterFlow={hasWaterFlow}
          style={{ top: -2, left: 400 }}
          totalizador_diario={latestTotalizadorSentina}
          totalizador_total={data.snapshot.totalizador_sentina.value}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.estanque.value / 100}
          maxVolume={4.2}
          style={{ top: 50, left: 700 }}
          name="Estanque 100m³"
          tiempoVaciado={data.tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
