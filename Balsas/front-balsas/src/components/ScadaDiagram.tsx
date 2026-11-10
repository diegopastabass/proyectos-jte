import React, { useLayoutEffect, useRef, useState } from "react";
import Tank from "./Tank";
import Pipe, { PipeTee, TEE_HALF } from "./Pipe";
import Pump from "./Pump";
import { FlowMeter, PressureGauge } from "./Instruments";
import "./scada/scada.css";
import {
  POZOS,
  formatMinutes,
  todayInChile,
  valorDeHoy,
  type Datos,
  type Metric,
  type PozoId,
} from "../balsas";

interface ScadaDiagramProps {
  data: Datos;
  /** Serie diaria del horómetro (minutos) por pozo. */
  horometro: Partial<Record<PozoId, Metric[]>>;
  totalizador: Metric[];
  totalizadorDescarga: Metric[];
}

/* El diagrama se dibuja en un lienzo fijo y se escala al ancho disponible. */
const STAGE_W = 1200;
const STAGE_H = 630;

/* Geometría (unidades del lienzo) */
const TOP_Y = 34; // colector superior que entra al estanque por el techo
const RISER_X = 640; // subida común de los ramales de los pozos
const GROUND_Y = 385;
const WATER_Y = 404; // espejo de agua dibujado en los pozos (no es una medición)
const PUMP_TOP = 410;
const BOTTOM_Y = 625;

const POZO_GEO: Record<PozoId, { x: number; ramalY: number; plate: { left: number; top: number } }> = {
  pozo_1: { x: 110, ramalY: 176, plate: { left:-60, top: 200 } },
  pozo_2: { x: 330, ramalY: 322, plate: { left: 170, top: 200 } },
};
const PLATE_W = 150;

// Cada pozo tiene su caudalímetro en su ramal. Presión y totalizador los reporta DOS_BALSAS
const FIT_X = 470;
const PI_X = 570;

const TANK = { x: 770, y: 70, w: 220, h: 270, inletX: 70 };
const DESCARGA_Y = 306;
const DESCARGA_FIN_X = 1188;
const FIT_DESCARGA_X = 1095;

// Mientras no llegue el caudal del Pozo 1, su flujo se anima a una velocidad fija
const VELOCIDAD_SIN_CAUDAL = 40;

// Velocidad visual del flujo proporcional al caudal
const flowSpeed = (caudal: number) => Math.min(90, 16 + caudal * 1.1);

const useStageScale = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / STAGE_W));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
};

const PlateRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="scada-plate__row">
    <span className="scada-plate__label">{label}</span>
    <span className="scada-plate__value">{value}</span>
  </div>
);

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  horometro,
  totalizador,
  totalizadorDescarga,
}) => {
  const { ref, scale } = useStageScale();
  const { snapshot, tiempo_vaciado, nivel_alerta, nivel_maximo } = data;
  const hoy = todayInChile();

  const caudal = snapshot.caudal?.value ?? 0;
  const caudalPozo1 = snapshot.pozo_1_caudal?.value ?? null;
  const presion = snapshot.presion?.value ?? 0;
  const caudalDescarga = snapshot.caudal_descarga?.value ?? 0;
  const nivel = snapshot.estanque?.value ?? 0;

  const pozos = POZOS.map((p) => {
    const corrientes = (["I1", "I2", "I3"] as const).map(
      (i) => snapshot[`${p.id}_${i}`]?.value ?? 0,
    );
    return {
      ...p,
      ...POZO_GEO[p.id],
      encendida: snapshot[`${p.id}_bomba`]?.value === 1,
      corriente: corrientes.reduce((a, b) => a + b, 0) / corrientes.length,
      horometroHoy: valorDeHoy(horometro[p.id], hoy),
    };
  });
  const [pozo1, pozo2] = pozos;
  const algunaEncendida = pozos.some((p) => p.encendida);

  const velocidadPozo1 = caudalPozo1 === null ? VELOCIDAD_SIN_CAUDAL : flowSpeed(caudalPozo1);
  const velocidadPozo2 = flowSpeed(caudal);
  const caudalColector =
    (pozo1.encendida ? (caudalPozo1 ?? 0) : 0) + (pozo2.encendida ? caudal : 0);
  const velocidadColector = caudalColector > 0 ? flowSpeed(caudalColector) : VELOCIDAD_SIN_CAUDAL;
  const inlet = TANK.x + TANK.inletX;

  return (
    <div ref={ref} className="scada scada-viewport" style={{ height: STAGE_H * scale }}>
      <div className="scada-stage" style={{ transform: `scale(${scale})` }}>
        {/* Subida común y colector superior: termina en el estanque */}
        <Pipe
          points={[
            [RISER_X, pozo1.ramalY],
            [RISER_X, TOP_Y],
            [inlet, TOP_Y],
            [inlet, TANK.y + 16],
          ]}
          flowing={algunaEncendida}
          speed={velocidadColector}
        />

        {/* Ramal del Pozo 2: llega a la subida con un codo */}
        <Pipe
          points={[
            [pozo2.x, PUMP_TOP],
            [pozo2.x, pozo2.ramalY],
            [RISER_X, pozo2.ramalY],
            [RISER_X, pozo1.ramalY],
          ]}
          flowing={pozo2.encendida}
          speed={velocidadPozo2}
        />

        {/* Ramal del Pozo 1: entra a la subida por una T */}
        <Pipe
          points={[
            [pozo1.x, PUMP_TOP],
            [pozo1.x, pozo1.ramalY],
            [RISER_X - TEE_HALF, pozo1.ramalY],
          ]}
          flowing={pozo1.encendida}
          speed={velocidadPozo1}
        />
        <PipeTee x={RISER_X} y={pozo1.ramalY} branch="left" />

        <FlowMeter x={FIT_X} y={pozo1.ramalY} value={caudalPozo1} active={pozo1.encendida} tag="FIT-03" />
        <FlowMeter x={FIT_X} y={pozo2.ramalY} value={snapshot.caudal ? caudal : null} active={pozo2.encendida} tag="FIT-01" />
        <PressureGauge x={PI_X} y={pozo2.ramalY} value={presion} max={12} tag="PI-01" />

        {pozos.map((p) => (
          <React.Fragment key={p.id}>
            <Pump
              x={p.x}
              groundY={GROUND_Y}
              waterY={WATER_Y}
              bottomY={BOTTOM_Y}
              pumpTop={PUMP_TOP}
              isActive={p.encendida}
              tag={p.tagBomba}
            />
            <div
              className="scada-plate pozo-plate"
              style={{ left: p.plate.left, top: p.plate.top, width: PLATE_W }}
            >
              <div className="pozo-plate__title">
                {p.nombre}
                <span className={`pozo-plate__estado${p.encendida ? " is-on" : ""}`}>
                  {p.encendida ? "En marcha" : "Detenida"}
                </span>
              </div>
              <PlateRow label="Corriente:" value={`${p.corriente.toFixed(1)} A`} />
              <PlateRow label="Horómetro hoy:" value={formatMinutes(p.horometroHoy)} />
            </div>
          </React.Fragment>
        ))}

        {/* Descarga del estanque hacia la red */}
        <Pipe
          points={[
            [TANK.x + TANK.w, DESCARGA_Y],
            [DESCARGA_FIN_X, DESCARGA_Y],
          ]}
          water={nivel > 0}
          flowing={caudalDescarga > 0}
          speed={flowSpeed(caudalDescarga)}
        />
        <FlowMeter
          x={FIT_DESCARGA_X}
          y={DESCARGA_Y}
          value={snapshot.caudal_descarga ? caudalDescarga : null}
          active={caudalDescarga > 0}
          tag="FIT-02"
        />
        <div className="scada-tag" style={{ position: "absolute", left: 1030, top: DESCARGA_Y + 44 }}>
          A RED DE DISTRIBUCIÓN →
        </div>

        <Tank
          x={TANK.x}
          y={TANK.y}
          width={TANK.w}
          height={TANK.h}
          level={nivel}
          maxLevel={nivel_maximo}
          alarmLevel={nivel_alerta}
          name="Estanque"
          tag="LIT-01"
          inletX={TANK.inletX}
          inflow={algunaEncendida}
          scaleStep={0.5}
          labelStep={1}
        >
          <div className="scada-plate scada-plate--info" style={{ position: "static", marginTop: 12, minWidth: 210 }}>
            <span className="scada-plate__label">Tiempo de Vaciado</span>
            <span className="scada-plate__value">
              {tiempo_vaciado.tiempo > 0 ? `Ø ${tiempo_vaciado.formatted}` : tiempo_vaciado.formatted}
            </span>
          </div>
        </Tank>

        {/* Placas de datos */}
        <div className="scada-plate scada-plate--filas" style={{ left: 450, top: 400, width: 260 }}>
          <div className="scada-plate__title">Impulsión Pozo 2</div>
          <PlateRow label="Caudal:" value={`${caudal.toFixed(1)} l/s`} />
          <PlateRow label="Presión:" value={`${presion.toFixed(1)} bar`} />
          <PlateRow label="Hoy:" value={`${valorDeHoy(totalizador, hoy).toFixed(1)} m³`} />
          <PlateRow label="Total:" value={`${(snapshot.totalizador?.value ?? 0).toFixed(1)} m³`} />
        </div>

        <div className="scada-plate scada-plate--filas" style={{ left: 1000, top: 400, width: 190 }}>
          <div className="scada-plate__title">Descarga a la red</div>
          <PlateRow label="Caudal:" value={`${caudalDescarga.toFixed(1)} l/s`} />
          <PlateRow label="Hoy:" value={`${valorDeHoy(totalizadorDescarga, hoy).toFixed(1)} m³`} />
          <PlateRow label="Total:" value={`${(snapshot.totalizador_descarga?.value ?? 0).toFixed(1)} m³`} />
          <PlateRow label="Panel solar:" value={`${(snapshot.solar?.value ?? 0).toFixed(2)} V`} />
        </div>
      </div>
    </div>
  );
};

export default ScadaDiagram;
