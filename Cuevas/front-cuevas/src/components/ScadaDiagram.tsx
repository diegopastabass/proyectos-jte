import React, { useLayoutEffect, useRef, useState } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import { FlowMeter, GateValve } from "./Instruments";
import State, { StateBody } from "./States";
import "./scada/scada.css";

interface Metric {
  value: number;
  time: string;
}

interface Snapshot {
  falla: Metric;
  bomba: Metric;
  asimetria: Metric;
  automatico: Metric;
  estanque: Metric;
  caudal: Metric;
  freatico: Metric;
  horometro: Metric;
  totalizador: Metric;
  L1: Metric;
  L2: Metric;
  L3: Metric;
  I1: Metric;
  I2: Metric;
  I3: Metric;
  // Estanque 20 m³ (ESTANQUE_20M3--slave.AI12 / AI32); pueden faltar si el equipo no reporta
  nivel_2?: Metric;
  voltaje_2?: Metric;
}

interface Datos {
  snapshot: Snapshot;
  tiempo_vaciado_est_1: number;
  tiempo_vaciado_est_1_formatted: string;
  nivel_alerta?: number;
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

/* Nivel crítico bajo del estanque 20 m³ (m). Igual que monitor_config.json */
const ALARMA_ESTANQUE_2 = 1.2;

const PHASES = [
  { phase: "L1", current: "I1", voltage: "L1" },
  { phase: "L2", current: "I2", voltage: "L2" },
  { phase: "L3", current: "I3", voltage: "L3" },
] as const;

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
  // nivel_2 llega en cm y voltaje_2 en mV
  const nivel2 = (snapshot.nivel_2?.value ?? 0) / 100;
  const voltaje2 = (snapshot.voltaje_2?.value ?? 0) / 1000;
  const nivelAlerta = data.nivel_alerta ?? 2;

  const latestHorometro = horometro.length > 0 ? horometro[horometro.length - 1].value : 0;
  const latestTotalizador = totalizador.length > 0 ? totalizador[totalizador.length - 1].value : 0;

  // Velocidad visual del flujo proporcional al caudal
  const flowSpeed = Math.min(90, 16 + caudal * 1.1);
  const tank1Inlet = TANK1.x + TANK1.inletX;
  const tank2Inlet = TANK2.x + TANK2.inletX;

  return (
    <div ref={ref} className="scada scada-viewport" style={{ height: STAGE_H * scale }}>
      <div className="scada-stage" style={{ transform: `scale(${scale})` }}>
        <div style={{ position: "absolute", left: 6, top: 14, width: 280, zIndex: 6 }}>
          <State>
            <StateBody
              automatico={snapshot.automatico.value.toString()}
              bomba={snapshot.bomba.value.toString()}
              asimetria={snapshot.asimetria.value.toString()}
              falla={snapshot.falla.value.toString()}
            />
          </State>
        </div>

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

        {/* Impulsión: bomba → estanque 75 m³ (entra por el techo) */}
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
        <GateValve x={268} y={PIPE_Y} tag="V-01" />
        <FlowMeter x={450} y={PIPE_Y} value={caudal} active={pumpOn} tag="FIT-01" />

        {/* Estanque 75 m³ → estanque 20 m³ */}
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
          maxLevel={4}
          alarmLevel={nivelAlerta}
          name="Estanque 75m³"
          tag="LIT-01"
          inletX={TANK1.inletX}
          inflow={pumpOn}
          scaleStep={0.5}
          labelStep={1}
        >
          <div className="scada-plate scada-plate--info" style={{ position: "static", marginTop: 14, minWidth: 230 }}>
            <span className="scada-plate__label">Tiempo de Vaciado Estanque</span>
            <span className="scada-plate__value">Ø {data.tiempo_vaciado_est_1_formatted}</span>
          </div>
        </Tank>

        <Tank
          x={TANK2.x}
          y={TANK2.y}
          width={TANK2.w}
          height={TANK2.h}
          level={nivel2}
          maxLevel={2}
          alarmLevel={ALARMA_ESTANQUE_2}
          name="Estanque 20m³"
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
          <PlateRow label="Horómetro:" value={formatMinutes(latestHorometro)} />
          <PlateRow label="Horómetro Total:" value={formatMinutes(snapshot.horometro.value)} />
        </div>

        {/* Panel solar del estanque 20 m³ */}
        <div className="scada-plate" style={{ left: 925, top: 372, width: 230 }}>
          <PlateRow label="Voltaje Panel Solar:" value={`${voltaje2.toFixed(2)} V`} />
        </div>

        {/* Tablero eléctrico de la bomba */}
        <div className="scada-plate scada-plate--grid" style={{ left: 925, top: 448, width: 230 }}>
          <div className="scada-plate__title">Tablero Eléctrico</div>
          <div className="scada-plate__table">
            <span />
            <span className="scada-plate__label">Corriente</span>
            <span className="scada-plate__label">Voltaje</span>
            {PHASES.map(({ phase, current, voltage }) => (
              <React.Fragment key={phase}>
                <span className="scada-plate__label">{phase}</span>
                <span className="scada-plate__value">{(snapshot[current].value / 100).toFixed(2)} A</span>
                <span className="scada-plate__value">{(snapshot[voltage].value / 10).toFixed(1)} V</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScadaDiagram;
