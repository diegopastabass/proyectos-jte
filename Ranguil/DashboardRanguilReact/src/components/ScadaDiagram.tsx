import React, { useLayoutEffect, useRef, useState } from "react";
import Tank from "./Tank";
import Pipe from "./Pipe";
import Pump from "./Pump";
import { FlowMeter, GateValve, PressureGauge } from "./Instruments";
import States from "./States";
import "./scada/scada.css";

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
  presion: Metric;
}

interface Metric {
  value: number;
  time: string;
}

interface ScadaDiagramProps {
  data: Snapshot;
  /** Horómetro del día (minutos), último valor de la serie. */
  hor: string;
  /** Totalizador del día (m³), último valor de la serie. */
  tot: string;
}

/* El diagrama se dibuja en un lienzo fijo y se escala al ancho disponible. */
const STAGE_W = 1200;
const STAGE_H = 630;

/* Geometría (unidades del lienzo) */
const PIPE_Y = 312;
const WELL_X = 360;
const GROUND_Y = 340;
const PUMP_TOP = 392;
const RISER_X = 620;
const TANK2_RISER_X = 915;

/* Ambos estanques tienen la misma altura, por lo que se dibujan del mismo tamaño. */
const TANK_W = 200;
const TANK_H = 250;
const TANK_Y = 50;
const TANK_INLET_X = 60;

const TANK1 = { x: 680, y: TANK_Y, w: TANK_W, h: TANK_H, inletX: TANK_INLET_X };
const TANK2 = { x: 975, y: TANK_Y, w: TANK_W, h: TANK_H, inletX: TANK_INLET_X };

/* Capacidad de ambos estanques tal como la usaba el diagrama con sprites (m). */
const MAX_LEVEL = 3.2;
/* Nivel de alarma baja: el mismo que usan los gráficos de nivel (0,5 m). */
const ALARM_LEVEL = 0.5;
/* Cota (m) a la que sale la tubería del estanque 1 hacia el estanque 2. */
const OUTLET_LEVEL = 0.2;
/* Volumen del estanque por metro de nivel, igual que en la vista móvil. */
const M3_PER_M = 60 / 7;

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

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({ data, hor, tot }) => {
  const { ref, scale } = useStageScale();
  const { snapshot } = data;

  const pumpOn = snapshot.bomba.value === 1;
  const fault = snapshot.falla.value === 1;
  const caudal = snapshot.caudal.value ?? 0;
  // Unidades del snapshot: freático en cm, presión en décimas de bar, estanque 1 en cm
  const freatico = (snapshot.freatico.value ?? 0) / 100;
  const presion = (snapshot.presion.value ?? 0) / 10;
  const nivel1 = (snapshot.estanque.value ?? 0) / 100;
  const nivel2 = snapshot.estanque_2.value ?? 0;
  const solar = (snapshot.solar?.value ?? 0) / 1000;

  // Velocidad visual del flujo proporcional al caudal
  const flowSpeed = Math.min(90, 16 + caudal * 1.1);
  const tank1Inlet = TANK1.x + TANK1.inletX;
  const tank2Inlet = TANK2.x + TANK2.inletX;

  return (
    <div ref={ref} className="scada scada-viewport" style={{ height: STAGE_H * scale }}>
      <div className="scada-stage" style={{ transform: `scale(${scale})` }}>
        {/* Placas de estado del tablero (se conservan tal cual) */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 245, zIndex: 6 }}>
          <States
            style={{ maxWidth: "245px", maxHeight: "200px" }}
            title="Estado Tablero"
            automatico={snapshot.automatico.value.toString()}
            falla={snapshot.falla.value.toString()}
            bomba={snapshot.bomba.value.toString()}
          />
          <States
            style={{ maxWidth: "245px", maxHeight: "260px" }}
            title="Tablero Eléctrico"
            corriente1={(snapshot.i1.value / 100).toString()}
            corriente2={(snapshot.i2.value / 100).toString()}
            corriente3={(snapshot.i3.value / 100).toString()}
            voltaje1={(snapshot.v1.value / 10).toString()}
            voltaje2={(snapshot.v2.value / 10).toString()}
            voltaje3={(snapshot.v3.value / 10).toString()}
          />
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

        {/* Impulsión: bomba → estanque nuevo (entra por el techo) */}
        <Pipe
          points={[
            [WELL_X, PUMP_TOP],
            [WELL_X, PIPE_Y],
            [RISER_X, PIPE_Y],
            [RISER_X, 22],
            [tank1Inlet, 22],
            [tank1Inlet, TANK1.y + 16],
          ]}
          flowing={pumpOn}
          speed={flowSpeed}
        />
        <PressureGauge x={420} y={PIPE_Y} value={presion} tag="PI-01" />
        <GateValve x={472} y={PIPE_Y} tag="V-01" />
        <FlowMeter x={545} y={PIPE_Y} value={caudal} active={pumpOn} tag="FIT-01" />

        {/* Estanque nuevo → estanque viejo */}
        <Pipe
          points={[
            [TANK1.x + TANK1.w, 272],
            [TANK2_RISER_X, 272],
            [TANK2_RISER_X, 22],
            [tank2Inlet, 22],
            [tank2Inlet, TANK2.y + 16],
          ]}
          water={nivel1 > OUTLET_LEVEL}
        />

        <Tank
          x={TANK1.x}
          y={TANK1.y}
          width={TANK1.w}
          height={TANK1.h}
          level={nivel1}
          maxLevel={MAX_LEVEL}
          alarmLevel={ALARM_LEVEL}
          name="Estanque Nuevo"
          tag="LIT-01"
          inletX={TANK1.inletX}
          inflow={pumpOn}
          scaleStep={0.2}
          labelStep={0.4}
        >
          {solar > 0 && <div className="tank__extra">☼ {solar.toFixed(2)} V</div>}
          <div className="tank__extra">{(nivel1 * M3_PER_M).toFixed(2)} m³</div>
          <div className="scada-plate scada-plate--info scada-plate--static">
            <span className="scada-plate__label">T. Vaciado</span>
            <span className="scada-plate__value">{data.tiempo_vaciado_est_1_formatted}</span>
          </div>
        </Tank>

        <Tank
          x={TANK2.x}
          y={TANK2.y}
          width={TANK2.w}
          height={TANK2.h}
          level={nivel2}
          maxLevel={MAX_LEVEL}
          alarmLevel={ALARM_LEVEL}
          name="Estanque Viejo"
          tag="LIT-02"
          scaleStep={0.2}
          labelStep={0.4}
        >
          <div className="tank__extra">{(nivel2 * M3_PER_M).toFixed(2)} m³</div>
          <div className="scada-plate scada-plate--info scada-plate--static">
            <span className="scada-plate__label">T. Vaciado</span>
            <span className="scada-plate__value">{data.tiempo_vaciado_est_2_formatted}</span>
          </div>
        </Tank>

        {/* Placas de datos */}
        <div className="scada-plate scada-plate--compact" style={{ left: 390, top: 4, width: 200 }}>
          <PlateRow label="Totalizador Por Día:" value={`${(Number(tot) || 0).toFixed(2)} m³`} />
          <PlateRow label="Totalizador:" value={`${(snapshot.totalizador.value || 0).toFixed(2)} m³`} />
          <PlateRow label="Caudal de Impulsión:" value={`${caudal.toFixed(2)} l/s`} />
          <PlateRow label="Presión:" value={`${presion.toFixed(2)} bar`} />
        </div>

        <div className="scada-plate" style={{ left: 490, top: 356, width: 190 }}>
          <PlateRow label="Freático:" value={`${freatico.toFixed(2)} m`} />
          <PlateRow label="Horómetro Por Día:" value={formatMinutes(Number(hor) || 0)} />
          {/* Horómetro total: viene del horómetro (minutos), no del totalizador */}
          <PlateRow label="Horómetro:" value={formatMinutes(snapshot.horometro.value)} />
        </div>
      </div>
    </div>
  );
};

export default ScadaDiagram;
