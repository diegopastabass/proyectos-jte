import React, { type CSSProperties } from "react";
import Tank from "./Tank";
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
  planta: 1 | 2;
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  hor,
  tot,
  planta,
}) => {
  const nivelMaxEstanque = 3;

  const imageAssets = {
    newTank: tankImage,
    newTank2: tank2Image,
    newPipe: pipeImage,
    newElbow: elbowImage,
    newPump: pumpImage,
  };

  const containerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: "600px",
    height: "600px",
    borderRadius: "8px",
    margin: "0 auto",
  };

  if (planta === 1) {
    const hasWaterFlow = data.snapshot.bomba_p1.value === 1;

    return (
      <div>
        <div style={containerStyle}>
          <States
            style={{
              maxWidth: "250px",
              maxHeight: "210px",
              marginBottom: "8px",
            }}
            title="Estado Tablero Planta 1"
            automatico_p1={data.snapshot.automatico_p1.value.toString()}
            bomba_p1={data.snapshot.bomba_p1.value.toString()}
            asimetria_p1={data.snapshot.asimetria_p1.value.toString()}
            falla_p1={data.snapshot.falla_p1.value.toString()}
          />
          <States
            title="Estado Presurizadora"
            style={{ maxWidth: "250px", maxHeight: "150px" }}
            falla_vdf1_p1={data.snapshot.falla_vdf1_p1.value.toString()}
            falla_vdf2_p1={data.snapshot.falla_vdf2_p1.value.toString()}
            presion={data.snapshot.presion.value.toFixed(2)}
          />

          {/* Bomba P1 */}
          <Pump
            spriteWidth={SPRITE_SIZE}
            spriteHeight={SPRITE_SIZE}
            sentido={0}
            image={imageAssets.newPump}
            isActive={hasWaterFlow}
            style={{ top: 263, left: 5 }}
          />

          {/* Codo P1 */}
          <Elbow
            spriteWidth={SPRITE_SIZE}
            spriteHeight={SPRITE_SIZE}
            a={0}
            b={0}
            image={imageAssets.newElbow}
            hasWaterFlow={hasWaterFlow}
            style={{ top: -36, left: 5 }}
          />

          {/* Estanque 1 */}
          <Tank
            spriteWidth={SPRITE_SIZE}
            spriteHeight={SPRITE_SIZE}
            positionX={300}
            positionY={0}
            image={imageAssets.newTank}
            volume={data.snapshot.estanque.value}
            maxVolume={nivelMaxEstanque}
            style={{ top: 0, left: 305 }}
            name="Estanque 1"
            labelX={320}
            labelY={-80}
            tiempoVaciado={data.tiempo_vaciado_est_1_formatted}
          />
        </div>
      </div>
    );
  }

  // Planta 2
  const hasWaterFlow = data.snapshot.bomba.value === 1;

  return (
    <div>
      <div style={containerStyle}>
        <States
          title="Estado Tablero Planta 2"
          style={{ maxWidth: "250px", maxHeight: "210px", marginBottom: "8px" }}
          automatico={data.snapshot.automatico.value.toString()}
          bomba={data.snapshot.bomba.value.toString()}
          falla_asimetria={"0"}
          falla={data.snapshot.falla.value.toString()}
        />

        {/* Bomba P2 */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 263, left: 5 }}
        />

        {/* Codo P2 */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          a={0}
          b={0}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: -36, left: 5 }}
          freatico={data.snapshot.freatico.value}
          horometro_diario={Number(hor)}
          horometro_total={data.snapshot.horometro.value}
          totalizador_diario={Number(tot)}
          totalizador_total={data.snapshot.totalizador.value}
          caudal={data.snapshot.caudal.value}
        />

        {/* Estanque 2 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={300}
          positionY={0}
          image={imageAssets.newTank}
          volume={data.snapshot.estanque_2.value}
          maxVolume={nivelMaxEstanque}
          style={{ top: 0, left: 305 }}
          name="Estanque 2"
          labelX={320}
          labelY={70}
          tiempoVaciado={data.tiempo_vaciado_est_2_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
