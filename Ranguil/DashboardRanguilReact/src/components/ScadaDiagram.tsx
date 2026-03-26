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
import tank2Image from "../assets/newTank2.png";

interface Snapshot {
  snapshot: DatosSnapshot;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
  tiempo_vaciado_est_2: number;
  tiempo_vaciado_est_2_formatted: string;
}

interface DatosSnapshot {
  automatico: Metric;
  bomba: Metric;
  caudal: Metric;
  estanque: Metric;
  estanque_2: Metric;
  falla: Metric;
  freatico: Metric;
  horometro: Metric;
  totalizador: Metric;
  solar: Metric;
  i1: Metric;
  i2: Metric;
  i3: Metric;
  v1: Metric;
  v2: Metric;
  v3: Metric;
  kwh: Metric;
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
    newTank: tankImage,
    newTank2: tank2Image,
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
          style={{ maxWidth: "230px", maxHeight: "200px" }}
          title="Estado Tablero"
          automatico={data.snapshot.automatico.value.toString()}
          falla={data.snapshot.falla.value.toString()}
          bomba={data.snapshot.bomba.value.toString()}
        />
        <States
          style={{ maxWidth: "230px", maxHeight: "280px" }}
          title="Tablero Eléctrico"
          corriente1={(data.snapshot.i1.value / 100).toString()}
          corriente2={(data.snapshot.i2.value / 100).toString()}
          corriente3={(data.snapshot.i3.value / 100).toString()}
          voltaje1={(data.snapshot.v1.value / 10).toString()}
          voltaje2={(data.snapshot.v2.value / 10).toString()}
          voltaje3={(data.snapshot.v3.value / 10).toString()}
          kwh={(data.snapshot.kwh.value / 10).toString()}
        ></States>
        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 300, left: 50 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 50 }}
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
          style={{ top: 0, left: 350 }}
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
          maxVolume={3.2}
          style={{ top: 0, left: 650 }}
          name="Estanque Nuevo"
          labelX={700}
          labelY={-160}
          tiempoVaciado={data.tiempo_vaciado_est_1_formatted}
          solar={data.snapshot.solar.value / 1000}
        />

        {/* 5. Tanque Secundario - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank2}
          volume={data.snapshot.estanque_2.value}
          maxVolume={3.2}
          style={{ top: 0, left: 950 }}
          name="Estanque Viejo"
          labelX={1000}
          labelY={-400}
          tiempoVaciado={data.tiempo_vaciado_est_2_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
