import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Elbow from "./Elbow";
import Tee from "./Tee";
import State, { StateBody } from "./States";
import newTankImage from "../assets/newTank.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";
import teeImage from "../assets/tee.png";

interface Metric {
  value: number;
  time: string;
}

interface MetricSnapshot {
  [key: string]: Metric;
}

interface Datos {
  pozo1: MetricSnapshot;
  pozo2: MetricSnapshot;
  estanque: MetricSnapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface ScadaDiagramProps {
  data: Datos;
  horometro: Metric[];
  totalizador: Metric[];
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  horometro,
  totalizador,
}) => {
  const hasWaterFlow1 = data.pozo1?.bomba?.value === 1;
  const hasWaterFlow2 = (data.pozo2?.caudal_pozos?.value ?? 0) > 0;

  const latestHorometro =
    horometro.length > 0 ? horometro[horometro.length - 1].value : 0;

  const latestTotalizador =
    totalizador.length > 0 ? totalizador[totalizador.length - 1].value : 0;

  const imageAssets = {
    newTank: newTankImage,
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
        <State
          title="Estado Tablero - San Enrique 6"
          style={{ maxWidth: "270px", maxHeight: "360px" }}
        >
          <StateBody
            automatico={data.pozo1?.automatico?.value?.toString() ?? "0"}
            falla={data.pozo1?.falla?.value?.toString() ?? "0"}
            bomba={data.pozo1?.bomba?.value?.toString() ?? "0"}
            falla_asimetria={data.pozo1?.asimetria?.value?.toString()}
            presion={data.pozo1?.presion?.value ?? 0}
            horometro_diario={latestHorometro}
            horometro_total={data.pozo1?.horometro?.value ?? 0}
          ></StateBody>
        </State>

        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow1}
          style={{ top: 300, left: 50 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          style={{ top: 0, left: 50 }}
        />

        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow2}
          style={{ top: 300, left: 123 }}
        />

        {/* 4. Tee - Junción con Pozo 2 */}
        <Tee
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          image={teeImage}
          style={{ top: 7, left: 105 }}
          labelY={320}
          labelX={340}
        />

        {/* 3. Tubería - Posición (300, 0) */}
        <Pipe
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={1}
          image={imageAssets.newPipe}
          hasWaterFlow={hasWaterFlow1 || hasWaterFlow2}
          style={{ top: 0, left: 405 }}
          caudal_pozo2={
            data.pozo2?.caudal_pozos?.value
              ? data.pozo2.caudal_pozos.value / 100
              : 0
          }
          caudal_pozo1={
            data.pozo1?.caudal?.value ? data.pozo1.caudal.value / 100 : 0
          }
          totalizador_diario={latestTotalizador / 10}
          totalizador_total={
            data.pozo1?.totalizador?.value
              ? data.pozo1.totalizador.value / 10
              : 0
          }
          titleTotalizador="San Enrique 6"
          titleCaudal="San Enrique 3"
        />

        {/* 5. Tanque Principal - Posición (600, 0). Max Volume: 4.5 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.estanque?.estanque?.value ?? 0}
          maxVolume={4.5}
          style={{ top: 50, left: 705 }}
          name="Estanque 200m³"
          labelOffsetX={170}
          tiempoVaciado={data.tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
