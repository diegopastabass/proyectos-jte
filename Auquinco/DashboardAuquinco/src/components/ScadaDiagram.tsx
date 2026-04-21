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
  automatico: Metric; //
  manual: Metric; //
  bomba: Metric; //
  temp: Metric; //
  petroleo: Metric; //
  rpm: Metric; //
  L1L2: Metric; //
  L2L3: Metric; //
  L3L1: Metric; //
  L1N: Metric; //
  L2N: Metric; //
  L3N: Metric; //
  I1: Metric; //
  I2: Metric; //
  I3: Metric; //
  PF: Metric; //
  KW1: Metric; //
  KW2: Metric; //
  KW3: Metric; //
  totalizador: Metric; //
  caudal: Metric; //
  estanque: Metric; //
  pozo: Metric; //
  horometro: Metric;
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

  const nivelMaxEstanque = 3;

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
          manual={data.snapshot.manual.value.toString()}
          bomba={data.snapshot.bomba.value.toString()}
        />

        <States
          style={{
            maxWidth: "250px",
            maxHeight: "230px",
            marginBottom: "8px",
          }}
          title="Estado Generador"
          temp={data.snapshot.temp.value.toFixed(2)}
          petroleo={data.snapshot.petroleo.value.toFixed(2)}
          rpm={data.snapshot.rpm.value.toFixed(2)}
          pf={data.snapshot.PF.value.toFixed(2)}
        />

        <States
          style={{
            maxWidth: "250px",
            maxHeight: "440px",
            marginTop: "-410px",
            marginLeft: "910px",
          }}
          title="Estado Tablero Eléctrico"
          l1l2={(data.snapshot.L1L2.value / 100).toFixed(2)}
          l2l3={(data.snapshot.L2L3.value / 100).toFixed(2)}
          l3l1={(data.snapshot.L3L1.value / 100).toFixed(2)}
          l1n={(data.snapshot.L1N.value / 100).toFixed(2)}
          l2n={(data.snapshot.L2N.value / 100).toFixed(2)}
          l3n={(data.snapshot.L3N.value / 100).toFixed(2)}
          i1={(data.snapshot.I1.value / 100).toFixed(2)}
          i2={(data.snapshot.I2.value / 100).toFixed(2)}
          i3={(data.snapshot.I3.value / 100).toFixed(2)}
          kw1={(data.snapshot.KW1.value / 10).toFixed(2)}
          kw2={(data.snapshot.KW2.value / 10).toFixed(2)}
          kw3={(data.snapshot.KW3.value / 10).toFixed(2)}
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
          freatico={data.snapshot.pozo.value}
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
          caudal={data.snapshot.caudal.value}
          totalizador_diario={Number(tot)}
          totalizador_total={data.snapshot.totalizador.value}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.estanque.value / 100}
          maxVolume={nivelMaxEstanque}
          style={{ top: 0, left: 605 }}
          name="Estanque 1"
          labelX={600}
          labelY={-150}
          tiempoVaciado={data.tiempo_vaciado_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
