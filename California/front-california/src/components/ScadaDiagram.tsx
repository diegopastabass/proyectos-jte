import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import Pump from "./Pump";
import Elbow from "./Elbow";
import States from "./States";
import tankImage from "../assets/newTank.png";
import pipeImage from "../assets/newPipe.png";
import elbowImage from "../assets/newElbow.png";
import pumpImage from "../assets/newPump.png";
import lilTank from "../assets/lilTank.png";

interface Snapshot {
  snapshot: Datos;
  tiempo_vaciado_1: number;
  tiempo_vaciado_1_formatted: string;
  tiempo_vaciado_2: number;
  tiempo_vaciado_2_formatted: string;
}

interface Datos {
  NIVEL_CERRO?: Metric;
  NIVEL_METALICO?: Metric;
  PRESION?: Metric;
  TELEMETRIA?: Metric;
  MANUAL?: Metric;
  TOTALIZADOR?: Metric;
  FREATICO?: Metric;
  BOMBA?: Metric;
  CAUDAL?: Metric;
}

interface Metric {
  value: number;
  time: string;
}

interface ScadaDiagramProps {
  data: Snapshot;
  hor: number; //Último valor value de horometro
  tot: number; //Último valor value de totalizador
}

const SPRITE_SIZE = 300;

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data, hor, tot }) => {
  const hasWaterFlow = (data.snapshot.BOMBA?.value ?? 0) === 1;

  const imageAssets = {
    newTank: tankImage,
    newTank2: lilTank,
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
          automatico={(data.snapshot.TELEMETRIA?.value ?? 0).toString()}
          bomba={(data.snapshot.BOMBA?.value ?? 0).toString()}
          manual={(data.snapshot.MANUAL?.value ?? 0).toString()}
        />
        {/* 1. Bomba - Posición (0, 300) */}
        <Pump
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          sentido={0}
          image={imageAssets.newPump}
          isActive={hasWaterFlow}
          style={{ top: 300, left: 200 }}
        />

        {/* 2. Codo - Posición (0, 0) */}
        <Elbow
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          image={imageAssets.newElbow}
          hasWaterFlow={hasWaterFlow}
          style={{ top: 0, left: 200 }}
          freatico={data.snapshot.FREATICO?.value ?? 0}
          horometro={hor}
          totalizador={tot}
          caudal={data.snapshot.CAUDAL?.value ?? 0}
          presion={data.snapshot.PRESION?.value ?? 0}
        />

        {/* 4. Tanque Principal - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank}
          level={data.snapshot.NIVEL_CERRO?.value ?? 0}
          maxLevel={100}
          maxVolume={100}
          style={{ top: 0, left: 500 }}
          name="Estanque Cerro 100 m³"
          labelX={520}
          labelY={100}
          tiempoVaciado={data.tiempo_vaciado_1_formatted}
        />

        {/* 5. Tanque Secundario - Posición (600, 0). Max Volume: 7 */}
        <Tank
          spriteWidth={SPRITE_SIZE}
          spriteHeight={SPRITE_SIZE}
          positionX={600}
          positionY={0}
          image={imageAssets.newTank2}
          level={data.snapshot.NIVEL_METALICO?.value ?? 0}
          maxLevel={100}
          maxVolume={40}
          style={{ top: 44, left: 800 }}
          name="Estanque Metálico 40 m³"
          labelX={830}
          labelY={-115}
          tiempoVaciado={data.tiempo_vaciado_2_formatted}
        />
      </div>
    </div>
  );
};

export default ScadaDiagram;
