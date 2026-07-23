import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pump from "./Pump";
import Elbow from "./Elbow";
import newTankImage from "../assets/newTank1.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";
import lilTankImage from "../assets/newTank2.png";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  totalizador_1: Metric;
  totalizador_2: Metric;
  totalizador_pozo: Metric;

  caudal_1: Metric;
  caudal_2: Metric;
  caudal_pozo: Metric;

  horometro_pozo: Metric;

  presion_1: Metric;
  presion_2: Metric;

  nivel_1: Metric;
  nivel_2: Metric;

  freatico: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
  tiempo_vaciado_est_2: number;
  tiempo_vaciado_est_2_formatted: string;
}

interface ScadaDiagramProps {
  data: Datos;
  horometroPozo: Metric[];
  totalizador1: Metric[];
  totalizador2: Metric[];
  totalizadorPozo: Metric[];
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  horometroPozo,
  totalizador1,
  totalizador2,
  totalizadorPozo,
}) => {
  const hasWaterFlow = data.snapshot.caudal_pozo.value > 0;

  const latestHorometroPozo =
    horometroPozo.length > 0
      ? horometroPozo[horometroPozo.length - 1].value
      : 0;

  const latestTotalizador1 =
    totalizador1.length > 0 ? totalizador1[totalizador1.length - 1].value : 0;

  const latestTotalizador2 =
    totalizador2.length > 0 ? totalizador2[totalizador2.length - 1].value : 0;

  const latestTotalizadorPozo =
    totalizadorPozo.length > 0
      ? totalizadorPozo[totalizadorPozo.length - 1].value
      : 0;

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
          isActive={hasWaterFlow}
          style={{ top: 280, left: 0 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: -20, left: 0 }}
          freatico={data.snapshot.freatico.value}
          presion1={data.snapshot.presion_1.value}
          presion2={data.snapshot.presion_2.value}
          horometroPozo={latestHorometroPozo}
          totalizador1={latestTotalizador1}
          totalizador2={latestTotalizador2}
          totalizadorPozo={latestTotalizadorPozo}
          caudal1={data.snapshot.caudal_1.value}
          caudal2={data.snapshot.caudal_2.value}
          caudalPozo={data.snapshot.caudal_pozo.value}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={300}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.nivel_1.value}
          maxVolume={4}
          style={{ top: -20, left: 300 }}
          name="Estanque 50m³"
          labelOffsetX={35}
          tiempoVaciado={data.tiempo_vaciado_est_1_formatted}
        />

        {/* 5. Tanque Secundario - Posición (900, 0). Max Volume: 2 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.lilTank}
          volume={data.snapshot.nivel_2.value}
          maxVolume={4}
          style={{ top: -20, left: 600 }}
          name="Estanque 100m³"
          labelOffsetX={35}
          tiempoVaciado={data.tiempo_vaciado_est_2_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
