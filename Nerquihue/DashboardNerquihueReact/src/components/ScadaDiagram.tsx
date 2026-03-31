import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import Elbow from "./Elbow";
import States from "./States";

import newTankImage from "../assets/newTank.png";
import lilTankImage from "../assets/lilTank.png";
import newPipeImage from "../assets/newPipe.png";
import newElbowImage from "../assets/newElbow.png";
import newPumpImage from "../assets/newPump.png";

interface Snapshot {
  snapshot: DatosSnapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface DatosSnapshot {
  automatico: Metric;
  bomba: Metric;
  caudal: Metric;
  estanque: Metric;
  falla: Metric;
  freatico: Metric;
  horometro: Metric;
  totalizador: Metric;
  i1: Metric;
  i2: Metric;
  i3: Metric;
  v1: Metric;
  v2: Metric;
  v3: Metric;
  kwh: Metric;
  presion: Metric;
}

interface Metric {
  value: number;
  time: string;
}

interface ScadaDiagramProps {
  data: Snapshot;
  hor: string;
  tot: string;
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data, hor, tot }) => {
  const hasWaterFlow = data.snapshot.bomba.value === 1;

  const imageAssets = {
    newTank: newTankImage,
    lilTank: lilTankImage,
    newPipe: newPipeImage,
    newElbow: newElbowImage,
    newPump: newPumpImage,
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
          title="Estado Tablero"
          style={{ maxWidth: "250px", maxHeight: "180px" }}
          automatico={data.snapshot.automatico.value.toString()}
          falla={data.snapshot.falla.value.toString()}
          bomba={data.snapshot.bomba.value.toString()}
        />
        <States
          style={{ maxWidth: "245px", maxHeight: "260px" }}
          title="Tablero Eléctrico"
          corriente1={(data.snapshot.i1.value / 100).toString()}
          corriente2={(data.snapshot.i2.value / 100).toString()}
          corriente3={(data.snapshot.i3.value / 100).toString()}
          voltaje1={(data.snapshot.v1.value / 10).toString()}
          voltaje2={(data.snapshot.v2.value / 10).toString()}
          voltaje3={(data.snapshot.v3.value / 10).toString()}
        ></States>
        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 300, left: 100 }}
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
          freatico={data.snapshot.freatico.value}
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
          style={{ top: 0, left: 400 }}
          caudal={data.snapshot.caudal.value}
          totalizador_diario={Number(tot)}
          totalizador_total={data.snapshot.totalizador.value}
          presion={data.snapshot.presion.value}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.estanque.value}
          maxVolume={3.5}
          style={{ top: 0, left: 700 }}
          name="Estanque 30m³"
          labelX={750}
          labelY={-150}
          tiempoVaciado={data.tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
