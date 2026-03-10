import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import newTankImage from "../assets/newTank.png";
import newPumpImage from "../assets/newPump.png";
import newElbowImage from "../assets/newElbow.png";
import Tank2 from "./Tank2";

interface Data {
  data: Datos;
  vaciado: DatosVaciado | null;
}

interface Datos {
  ssr_bucalemu_bajo_nivel: Metric;
  ssr_bucalemu_bajo_temperatura: Metric;
  ssr_nilahue_nivel: Metric;
  ssr_nilahue_bomba: Metric;
  ssr_casuto_nivel: Metric;
  ssr_casuto_bateria: Metric;
  ssr_bucalemu_alto_nivel: Metric;
  ssr_nilahue_caudal: Metric;
  ssr_nilahue_totalizador: Metric;
}

interface DatosVaciado {
  t_vaciado_bucalemu_alto_nivel: string;
  t_vaciado_bucalemu_bajo_nivel: string;
  t_vaciado_nilahue_nivel: string;
  t_vaciado_casuto_nivel: string;
}

interface Metric {
  value: number;
  time: string;
}

const SPRITE_SIZE = 300;
const RENDER_SIZE = 200;
const GAP = 30;

const ScadaDiagram: React.FC<Data> = ({ data, vaciado }) => {
  const imageAssets = {
    newTank: newTankImage,
    newPump: newPumpImage,
    newElbow: newElbowImage,
  };

  const mainContainerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "590px",
    overflowX: "auto",
  };

  // Estilo específico para la etiqueta de la bomba
  const pumpLabelStyle: CSSProperties = {
    position: "absolute",
    top: 380, // Ajustado para centrar verticalmente respecto a la bomba
    left: 110, // (-100 de la bomba + 200 ancho + 10 margen)
    zIndex: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: "10px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    minWidth: "180px", // Ancho mínimo garantizado
    textAlign: "center",
    border: "1px solid #dee2e6",
  };

  const getX = (index: number) => (RENDER_SIZE + GAP) * index + 100;

  return (
    <div style={mainContainerStyle}>
      {/* Etiqueta de la bomba (Renderizado independiente) */}
      <div style={pumpLabelStyle}>
        <div style={{ marginBottom: "4px" }}>
          <span className="text-muted small d-block">Totalizador:</span>
          <strong style={{ fontSize: "1.1em" }}>
            {data.ssr_nilahue_totalizador.value.toFixed(2)} m³
          </strong>
        </div>
        <div>
          <span className="text-muted small d-block">Caudal:</span>
          <strong style={{ fontSize: "1.1em" }}>
            {data.ssr_nilahue_caudal.value.toFixed(2)} l/s
          </strong>
        </div>
      </div>

      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        displaySize={RENDER_SIZE}
        positionX={getX(0)}
        positionY={0}
        time={data.ssr_nilahue_nivel.time}
        image={imageAssets.newTank}
        volume={data.ssr_nilahue_nivel.value}
        maxVolume={4.25}
        name="Nilahue"
        tiempoVaciado={
          vaciado?.t_vaciado_nilahue_nivel == "0s"
            ? "Llenando"
            : vaciado?.t_vaciado_nilahue_nivel
        }
      />

      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        displaySize={RENDER_SIZE}
        positionX={getX(1)}
        positionY={0}
        time={data.ssr_casuto_nivel.time}
        image={imageAssets.newTank}
        volume={data.ssr_casuto_nivel.value}
        maxVolume={4.25}
        name="Casuto"
        tiempoVaciado={
          vaciado?.t_vaciado_casuto_nivel == "0s"
            ? "Llenando"
            : vaciado?.t_vaciado_casuto_nivel
        }
      />

      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        displaySize={RENDER_SIZE}
        positionX={getX(2)}
        positionY={0}
        time={data.ssr_bucalemu_bajo_nivel.time}
        image={imageAssets.newTank}
        volume={data.ssr_bucalemu_bajo_nivel.value}
        maxVolume={4.25}
        name="Bucalemu Bajo"
        tiempoVaciado={
          vaciado?.t_vaciado_bucalemu_bajo_nivel == "0s"
            ? "Llenando"
            : vaciado?.t_vaciado_bucalemu_bajo_nivel
        }
      />

      <Tank2
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        displaySize={RENDER_SIZE}
        positionX={getX(3)}
        positionY={0}
        time={data.ssr_bucalemu_alto_nivel.time}
        image={imageAssets.newTank}
        volume={data.ssr_bucalemu_alto_nivel.value}
        maxVolume={4.25}
        name="Bucalemu Alto"
        tiempoVaciado={
          vaciado?.t_vaciado_bucalemu_alto_nivel == "0s"
            ? "Llenando"
            : vaciado?.t_vaciado_bucalemu_alto_nivel
        }
      />
    </div>
  );
};

export default ScadaDiagram;
