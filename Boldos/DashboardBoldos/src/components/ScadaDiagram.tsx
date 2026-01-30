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
  automatico_p1: Metric;
  asimetria_p1: Metric;
  falla_vdf1_p1: Metric;
  falla_vdf2_p1: Metric;
  bomba_p1: Metric;
  falla_p1: Metric;
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

  const nivelMaxEstanque = 3;
  const nivelMaxEstanque2 = 3;

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
          style={{
            maxWidth: "240px",
            maxHeight: "200px",
            marginBottom: "5px",
          }}
          title="Estado Tablero Planta 1"
          automatico_p1={data.snapshot.automatico_p1.value.toString()}
          asimetria_p1={data.snapshot.asimetria_p1.value.toString()}
          bomba_p1={data.snapshot.bomba_p1.value.toString()}
          falla_p1={data.snapshot.falla_p1.value.toString()}
        />

        <States
          title="Estado Tablero Planta 2"
          style={{ maxWidth: "240px", maxHeight: "150px" }}
          automatico={data.snapshot.automatico.value.toString()}
          falla={data.snapshot.falla.value.toString()}
          bomba={data.snapshot.bomba.value.toString()}
        />

        <States
          title="Estado Presurizadora"
          style={{ maxWidth: "240px", maxHeight: "150px" }}
          falla_vdf1_p1={data.snapshot.falla_vdf1_p1.value.toString()}
          falla_vdf2_p1={data.snapshot.falla_vdf2_p1.value.toString()}
          presion={data.snapshot.presion.value.toFixed(2)}
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
          volume={data.snapshot.estanque.value}
          maxVolume={nivelMaxEstanque}
          style={{ top: 0, left: 605 }}
          name="Estanque 1"
          labelX={600}
          labelY={-180}
          tiempoVaciado={data.tiempo_vaciado_est_1_formatted}
        />

        {/* 5. Tanque Secundario - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank2}
          volume={data.snapshot.estanque_2.value}
          maxVolume={nivelMaxEstanque2}
          style={{ top: 0, left: 905 }}
          name="Estanque 2"
          labelX={900}
          labelY={-390}
          tiempoVaciado={data.tiempo_vaciado_est_2_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
