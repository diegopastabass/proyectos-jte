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
  falla: Metric; //
  bomba: Metric; //
  asimetria: Metric; //
  automatico: Metric; //
  estanque: Metric; //
  caudal: Metric; //
  horometro: Metric; //
  totalizador: Metric; //
  freatico: Metric; //
  L1: Metric;
  L2: Metric;
  L3: Metric;
  I1: Metric;
  I2: Metric;
  I3: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
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
  const hasWaterFlow = data.snapshot.bomba.value === 1;

  const latestHorometro =
    horometro.length > 0 ? horometro[horometro.length - 1].value : 0;

  const latestTotalizador =
    totalizador.length > 0 ? totalizador[totalizador.length - 1].value : 0;

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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", zIndex: 10, position: "relative" }}>
          <State style={{ maxWidth: "250px" }}>
            <StateBody
              automatico={data.snapshot.automatico.value.toString()}
              falla={data.snapshot.falla.value.toString()}
              bomba={data.snapshot.bomba.value.toString()}
              asimetria={data.snapshot.asimetria.value.toString()}
            ></StateBody>
          </State>
          <State style={{ maxWidth: "250px" }}>
            <StateBody
              title="Tablero Eléctrico"
              corriente1={(data.snapshot.I1.value / 100).toString()}
              corriente2={(data.snapshot.I2.value / 100).toString()}
              corriente3={(data.snapshot.I3.value / 100).toString()}
              voltaje1={(data.snapshot.L1.value / 10).toString()}
              voltaje2={(data.snapshot.L2.value / 10).toString()}
              voltaje3={(data.snapshot.L3.value / 10).toString()}
            ></StateBody>
          </State>
        </div>
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
          horometro_diario={latestHorometro}
          horometro_total={data.snapshot.totalizador.value}
          freatico={data.snapshot.freatico.value / 100}
        />

        {/* 3. Tubería - Posición (300, 0) */}
        <Pipe
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={1}
          image={imageAssets.newPipe}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 270 }}
          caudal={data.snapshot.caudal.value}
          totalizador_diario={latestTotalizador}
          totalizador_total={data.snapshot.totalizador.value}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.estanque.value}
          maxVolume={4}
          style={{ top: 0, left: 570 }}
          name="Estanque 75m³"
          labelOffsetX={35}
          tiempoVaciado={data.tiempo_vaciado_est_1_formatted.toString()}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
