import React, { useLayoutEffect, useRef, useState } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import { FlowMeter, GateValve, PressureGauge } from "./Instruments";
import State, { StateBody } from "./States";
import "./scada/scada.css";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  falla: Metric;
  bomba: Metric;
  automatico: Metric;
  estanque: Metric;
  estanque_2: Metric;
  caudal: Metric;
  freatico: Metric;
  presion: Metric;
  horometro: Metric;
  totalizador: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface ScadaDiagramProps {
  data: Datos;
  horometro: Metric[];
  totalizador: Metric[];
}

/* El diagrama se dibuja en un lienzo fijo y se escala al ancho disponible. */
const STAGE_W = 1200;
const STAGE_H = 630;

/* Geometría (unidades del lienzo) */
const PIPE_Y = 312;
const WELL_X = 140;
const GROUND_Y = 340;
const PUMP_TOP = 392;

const TANK1 = { x: 660, y: 50, w: 200, h: 250, inletX: 60 };
const TANK2 = { x: 980, y: 110, w: 180, h: 140, inletX: 65 };

const formatMinutes = (total: number) => {
  const minutes = Math.max(0, Math.floor(total));
  return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
};

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

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data, horometro, totalizador }) => {
  const { ref, scale } = useStageScale();
  const { snapshot } = data;

  const pumpOn = snapshot.bomba.value === 1;
  const fault = snapshot.falla.value === 1;
  const caudal = snapshot.caudal.value ?? 0;
  const freatico = (snapshot.freatico.value ?? 0) / 100;
  const presion = (snapshot.presion.value ?? 0) / 10;

  const latestHorometro = horometro.length > 0 ? horometro[horometro.length - 1].value : 0;
  const latestTotalizador = totalizador.length > 0 ? totalizador[totalizador.length - 1].value : 0;

  // Velocidad visual del flujo proporcional al caudal
  const flowSpeed = Math.min(90, 16 + caudal * 1.1);
  const tank1Inlet = TANK1.x + TANK1.inletX;
  const tank2Inlet = TANK2.x + TANK2.inletX;

  return (
    <div ref={ref} className="scada scada-viewport" style={{ height: STAGE_H * scale }}>
      <div className="scada-stage" style={{ transform: `scale(${scale})` }}>
        <State style={{ maxWidth: "250px", maxHeight: "180px", position: "relative", zIndex: 6 }}>
          <StateBody
            automatico={snapshot.automatico.value.toString()}
            falla={snapshot.falla.value.toString()}
            bomba={snapshot.bomba.value.toString()}
          />
        </State>

        {/* Pozo y bomba sumergible */}
        <Pump
          x={WELL_X}
          groundY={GROUND_Y}
          waterY={372}
          bottomY={618}
          pumpTop={PUMP_TOP}
          isActive={pumpOn}
          fault={fault}
          freatico={freatico}
        />

        {/* Impulsión: bomba → estanque 350 m³ (entra por el techo) */}
        <Pipe
          points={[
            [WELL_X, PUMP_TOP],
            [WELL_X, PIPE_Y],
            [590, PIPE_Y],
            [590, 22],
            [tank1Inlet, 22],
            [tank1Inlet, TANK1.y + 16],
          ]}
          flowing={pumpOn}
          speed={flowSpeed}
        />
        <PressureGauge x={205} y={PIPE_Y} value={presion} tag="PI-01" />
        <GateValve x={268} y={PIPE_Y} tag="V-01" />
        <FlowMeter x={450} y={PIPE_Y} value={caudal} active={pumpOn} tag="FIT-01" />

        {/* Estanque 350 m³ → estanque 2 m³ */}
        <Pipe
          points={[
            [TANK1.x + TANK1.w, 272],
            [905, 272],
            [905, 88],
            [tank2Inlet, 88],
            [tank2Inlet, TANK2.y + 14],
          ]}
          water={snapshot.estanque.value > 0.4}
        />

        <Tank
          x={TANK1.x}
          y={TANK1.y}
          width={TANK1.w}
          height={TANK1.h}
          level={snapshot.estanque.value}
          maxLevel={7}
          alarmLevel={2}
          name="Estanque 350m³"
          tag="LIT-01"
          inletX={TANK1.inletX}
          inflow={pumpOn}
          scaleStep={0.5}
          labelStep={1}
        >
          <div className="scada-plate scada-plate--info" style={{ position: "static", marginTop: 14, minWidth: 230 }}>
            <span className="scada-plate__label">Tiempo de Vaciado Estanque</span>
            <span className="scada-plate__value">Ø {data.tiempo_vaciado_formatted}</span>
          </div>
        </Tank>

        <Tank
          x={TANK2.x}
          y={TANK2.y}
          width={TANK2.w}
          height={TANK2.h}
          level={snapshot.estanque_2.value}
          maxLevel={2}
          name="Estanque 2m³"
          tag="LIT-02"
          scaleStep={0.25}
          labelStep={0.5}
        />

        {/* Placas de datos */}
        <div className="scada-plate" style={{ left: 330, top: 80, width: 180 }}>
          <PlateRow label="Totalizador:" value={`${(latestTotalizador || 0).toFixed(2)} m³`} />
          <PlateRow label="Totalizador Total:" value={`${(snapshot.totalizador.value || 0).toFixed(2)} m³`} />
          <PlateRow label="Caudal de Impulsión:" value={`${caudal.toFixed(2)} l/s`} />
        </div>

        <div className="scada-plate" style={{ left: 260, top: 350, width: 190 }}>
          <PlateRow label="Freático:" value={`${freatico.toFixed(2)} m`} />
          <PlateRow label="Presión:" value={`${presion.toFixed(2)} bar`} />
          <PlateRow label="Horómetro:" value={formatMinutes(latestHorometro)} />
          <PlateRow label="Horómetro Total:" value={formatMinutes(snapshot.horometro.value)} />
        </div>
      </div>
    </div>
  );
};

export default ScadaDiagram;
