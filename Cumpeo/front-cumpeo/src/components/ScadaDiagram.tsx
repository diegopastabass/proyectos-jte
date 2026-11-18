import React, { useLayoutEffect, useRef, useState } from "react";
import Tank from "./Tank";
import Pipe, { PIPE_D } from "./Pipe";
import Pump from "./Pump";
import { FlowMeter, PressureGauge } from "./Instruments";
import State, { StateBody } from "./States";
import DataArrivalIndicator from "./DataArrivalIndicator";
import "./scada/scada.css";

interface Metric {
  value: number;
  time: string;
}

interface MetricSnapshot {
  [key: string]: Metric;
}

interface Datos {
  pozo1: MetricSnapshot;
  pozo2: MetricSnapshot;
  estanque: MetricSnapshot;
  tiempo_vaciado: number;
  tiempo_vaciado_formatted: string;
}

interface ScadaDiagramProps {
  data: Datos;
  horometro: Metric[];
  horometroPozo2?: Metric[];
  totalizador: Metric[];
}

/** Returns the most recent timestamp from all metrics in a snapshot */
function getLatestTime(snapshot: MetricSnapshot | undefined): string | undefined {
  if (!snapshot) return undefined;
  const times = Object.values(snapshot)
    .map((m) => new Date(m.time).getTime())
    .filter((t) => !isNaN(t));
  if (times.length === 0) return undefined;
  return new Date(Math.max(...times)).toISOString();
}

/* El diagrama se dibuja en un lienzo fijo y se escala al ancho disponible. */
const STAGE_W = 1200;
const STAGE_H = 668; // 630 del dibujo + franja inferior para los indicadores de datos

/* Geometría (unidades del lienzo) */
const PIPE_Y = 312;
const GROUND_Y = 340;
const PUMP_TOP = 392;
const WELL1_X = 130; // San Enrique 3
const WELL2_X = 350; // San Enrique 1 (se une a la línea en este punto)
const RISER_X = 650; // subida hacia el techo del estanque
const TOP_Y = 22;
const PIPE_HALF = PIPE_D / 2;

const TANK = { x: 780, y: 50, w: 220, h: 250, inletX: 70 };
const TANK_MAX_LEVEL = 4.5;
const TANK_ALARM_LEVEL = 2.5;

/* Unidades de los datos crudos */
const PRESION_DIV = 10; // décimas de bar
const TOTALIZADOR_DIV = 10; // décimas de m³
const CAUDAL_POZO2_DIV = 100;

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

const lastValue = (list: Metric[]) => (list.length > 0 ? list[list.length - 1].value : 0);

const ScadaDiagram: React.FC<ScadaDiagramProps> = ({
  data,
  horometro,
  horometroPozo2 = [],
  totalizador,
}) => {
  const { ref, scale } = useStageScale();

  const pozo1On = data.pozo1?.bomba?.value === 1;
  const fault = data.pozo1?.falla?.value === 1;
  const caudal1 = data.pozo1?.caudal?.value ?? 0;
  const caudal2 = (data.pozo2?.caudal_pozos?.value ?? 0) / CAUDAL_POZO2_DIV;
  const pozo2On = caudal2 > 0;
  const anyPumpOn = pozo1On || pozo2On;
  const presion = (data.pozo1?.presion?.value ?? 0) / PRESION_DIV;
  const nivel = data.estanque?.estanque?.value ?? 0;

  const totalizadorDiario = lastValue(totalizador) / TOTALIZADOR_DIV;
  const totalizadorTotal = (data.pozo1?.totalizador?.value ?? 0) / TOTALIZADOR_DIV;

  // Velocidad visual del flujo proporcional al caudal
  const speedOf = (q: number) => Math.min(90, 16 + q * 1.1);
  const tankInlet = TANK.x + TANK.inletX;

  return (
    <div ref={ref} className="scada scada-viewport" style={{ height: STAGE_H * scale }}>
      <div
        className="scada-stage"
        style={{ height: STAGE_H, transform: `scale(${scale})` }}
      >
        <State
          title="Estado Tablero - San Enrique 3"
          style={{ maxWidth: "275px", maxHeight: "235px", position: "relative", zIndex: 6 }}
        >
          <StateBody
            automatico={data.pozo1?.automatico?.value?.toString() ?? "0"}
            falla={data.pozo1?.falla?.value?.toString() ?? "0"}
            bomba={data.pozo1?.bomba?.value?.toString() ?? "0"}
            falla_asimetria={data.pozo1?.asimetria?.value?.toString()}
          />
        </State>

        {/* Pozos y bombas sumergibles */}
        <Pump
          x={WELL1_X}
          groundY={GROUND_Y}
          waterY={372}
          bottomY={618}
          pumpTop={PUMP_TOP}
          isActive={pozo1On}
          fault={fault}
          tag="B-01"
        />
        <Pump
          x={WELL2_X}
          groundY={GROUND_Y}
          waterY={372}
          bottomY={618}
          pumpTop={PUMP_TOP}
          isActive={pozo2On}
          tag="B-02"
        />

        {/* San Enrique 1: sube y se une a la línea de impulsión */}
        <Pipe
          points={[
            [WELL2_X, PUMP_TOP],
            [WELL2_X, PIPE_Y + PIPE_HALF],
          ]}
          flowing={pozo2On}
          speed={speedOf(caudal2)}
        />

        {/* San Enrique 3: bomba → empalme */}
        <Pipe
          points={[
            [WELL1_X, PUMP_TOP],
            [WELL1_X, PIPE_Y],
            [WELL2_X, PIPE_Y],
          ]}
          flowing={pozo1On}
          speed={speedOf(caudal1)}
        />

        {/* Impulsión común → estanque (entra por el techo) */}
        <Pipe
          points={[
            [WELL2_X, PIPE_Y],
            [RISER_X, PIPE_Y],
            [RISER_X, TOP_Y],
            [tankInlet, TOP_Y],
            [tankInlet, TANK.y + 16],
          ]}
          flowing={anyPumpOn}
          speed={speedOf(caudal1 + caudal2)}
        />

        <PressureGauge x={200} y={PIPE_Y} value={presion} max={10} tag="PI-01" />
        <FlowMeter x={282} y={PIPE_Y} value={caudal1} active={pozo1On} tag="FIT-01" />
        <FlowMeter
          x={500}
          y={PIPE_Y}
          value={caudal1 + caudal2}
          active={anyPumpOn}
          tag="FIT-T"
        />

        <Tank
          x={TANK.x}
          y={TANK.y}
          width={TANK.w}
          height={TANK.h}
          level={nivel}
          maxLevel={TANK_MAX_LEVEL}
          alarmLevel={TANK_ALARM_LEVEL}
          name="Estanque 200m³"
          tag="LIT-01"
          inletX={TANK.inletX}
          inflow={anyPumpOn}
          scaleStep={0.5}
          labelStep={1}
        >
          <div
            className="scada-plate scada-plate--info"
            style={{ position: "static", marginTop: 14, minWidth: 230 }}
          >
            <span className="scada-plate__label">Tiempo de Vaciado Estanque</span>
            <span className="scada-plate__value">Ø {data.tiempo_vaciado_formatted}</span>
          </div>
        </Tank>

        {/* Placas de datos */}
        <div className="scada-plate" style={{ left: 280, top: 24, width: 185 }}>
          <span className="scada-plate__label" style={{ fontWeight: 700 }}>
            San Enrique 3
          </span>
          <PlateRow label="Totalizador:" value={`${totalizadorDiario.toFixed(2)} m³`} />
          <PlateRow label="Totalizador Total:" value={`${totalizadorTotal.toFixed(2)} m³`} />
          <PlateRow label="Caudal de Impulsión:" value={`${caudal1.toFixed(2)} l/s`} />
        </div>

        <div className="scada-plate" style={{ left: 470, top: 24, width: 165 }}>
          <span className="scada-plate__label" style={{ fontWeight: 700 }}>
            &nbsp;
          </span>
          <PlateRow label="Presión:" value={`${presion.toFixed(2)} bar`} />
          <PlateRow label="Horómetro:" value={formatMinutes(lastValue(horometro))} />
          <PlateRow
            label="Horómetro Total:"
            value={formatMinutes(data.pozo1?.horometro?.value ?? 0)}
          />
        </div>

        <div className="scada-plate" style={{ left: 490, top: 350, width: 200 }}>
          <span className="scada-plate__label" style={{ fontWeight: 700 }}>
            San Enrique 1
          </span>
          <PlateRow label="Caudal de Impulsión:" value={`${caudal2.toFixed(2)} l/s`} />
          <PlateRow label="Horómetro:" value={formatMinutes(lastValue(horometroPozo2))} />
        </div>

        {/* Indicadores de llegada de datos, bajo la bomba de cada pozo */}
        {[
          { x: WELL1_X, label: "San Enrique 3", snapshot: data.pozo1 },
          { x: WELL2_X, label: "San Enrique 1", snapshot: data.pozo2 },
        ].map(({ x, label, snapshot }) => (
          <div
            key={label}
            style={{
              position: "absolute",
              left: x - 110,
              width: 220,
              top: 630,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <DataArrivalIndicator label={label} latestTime={getLatestTime(snapshot)} compact />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScadaDiagram;
