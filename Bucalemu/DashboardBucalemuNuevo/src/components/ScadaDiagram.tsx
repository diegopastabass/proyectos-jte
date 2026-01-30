import React, { type CSSProperties } from "react";
import Tank from "./Tank";
import newTankImage from "../assets/newTank.png";

// Interfaces (sin cambios)
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
const GAP = 50; // Espacio entre tanques

const ScadaDiagram: React.FC<Data> = ({ data, vaciado }) => {
  const imageAssets = {
    newTank: newTankImage,
  };

  // Contenedor Maestro
  const mainContainerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "600px", // Altura suficiente para tanque + texto
    overflowX: "auto", // Por si la pantalla es muy chica
  };

  return (
    <div style={mainContainerStyle}>
      {/* Bucalemu Alto (X = 0) */}
      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        positionX={0}
        positionY={0}
        image={imageAssets.newTank}
        volume={data.ssr_bucalemu_alto_nivel.value}
        maxVolume={4.25}
        name="Bucalemu Alto"
        tiempoVaciado={vaciado?.t_vaciado_bucalemu_alto_nivel || "Llenando"}
      />

      {/* Bucalemu Bajo (X = 350) */}
      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        positionX={SPRITE_SIZE + GAP}
        positionY={0}
        image={imageAssets.newTank}
        volume={data.ssr_bucalemu_bajo_nivel.value}
        maxVolume={4.25}
        name="Bucalemu Bajo"
        tiempoVaciado={vaciado?.t_vaciado_bucalemu_bajo_nivel || "Llenando"}
      />

      {/* Nilahue (X = 700) */}
      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        positionX={(SPRITE_SIZE + GAP) * 2}
        positionY={0}
        image={imageAssets.newTank}
        volume={data.ssr_nilahue_nivel.value}
        maxVolume={4.25}
        name="Nilahue"
        tiempoVaciado={vaciado?.t_vaciado_nilahue_nivel || "Llenando"}
      />

      {/* Casuto (X = 1050) */}
      <Tank
        spriteWidth={SPRITE_SIZE}
        spriteHeight={SPRITE_SIZE}
        positionX={(SPRITE_SIZE + GAP) * 3}
        positionY={0}
        image={imageAssets.newTank}
        volume={data.ssr_casuto_nivel.value}
        maxVolume={4.25}
        name="Casuto"
        tiempoVaciado={vaciado?.t_vaciado_casuto_nivel || "Llenando"}
      />
    </div>
  );
};

export default ScadaDiagram;
