import React, { type CSSProperties } from "react";
import { PIPE_D } from "./Pipe";

/* Todos los instrumentos se ubican por el punto (x, y) del eje de la tubería. */

interface GaugeProps {
  x: number;
  y: number;
  value: number;
  max?: number;
  unit?: string;
  tag?: string;
}

const GAUGE_R = 20;
const GAUGE_STEM = 12;

export const PressureGauge: React.FC<GaugeProps> = ({
  x,
  y,
  value,
  max = 10,
  unit = "bar",
  tag,
}) => {
  const ratio = Math.min(1, Math.max(0, value / max));
  const cy = y - PIPE_D / 2 - GAUGE_STEM - GAUGE_R;

  return (
    <>
      <div
        className="gauge__stem"
        style={{ left: x - 3, top: cy + GAUGE_R - 2, height: GAUGE_STEM + 4 }}
      />
      <div
        className="gauge"
        style={{ left: x - GAUGE_R, top: cy - GAUGE_R, width: GAUGE_R * 2, height: GAUGE_R * 2 }}
        title={`${value.toFixed(2)} ${unit}`}
      >
        <div className="gauge__face">
          <div className="gauge__zone" />
          <div className="gauge__ticks" />
          <span className="gauge__unit">{unit}</span>
          <div
            className="gauge__needle"
            style={
              {
                height: GAUGE_R - 7,
                "--angle": `${(-135 + 270 * ratio).toFixed(1)}deg`,
              } as CSSProperties
            }
          />
          <div className="gauge__hub" />
        </div>
      </div>
      {tag && (
        <span className="scada-tag" style={{ left: x, top: cy - GAUGE_R - 13 }}>
          {tag}
        </span>
      )}
    </>
  );
};

interface ValveProps {
  x: number;
  y: number;
  tag?: string;
}

export const GateValve: React.FC<ValveProps> = ({ x, y, tag }) => {
  const w = 26;
  const h = 22;
  return (
    <>
      <div className="valve__stem" style={{ left: x - 1.5, top: y - 22, height: 18 }} />
      <div className="valve__wheel" style={{ left: x - 12, top: y - 26, width: 24 }} />
      <div className="valve" style={{ left: x - w / 2, top: y - h / 2, width: w, height: h }}>
        <div className="valve__body" />
      </div>
      {tag && (
        <span className="scada-tag" style={{ left: x, top: y + h / 2 + 6 }}>
          {tag}
        </span>
      )}
    </>
  );
};

interface FlowMeterProps {
  x: number;
  y: number;
  value: number;
  active: boolean;
  tag?: string;
}

export const FlowMeter: React.FC<FlowMeterProps> = ({ x, y, value, active, tag }) => {
  const spoolW = 44;
  const spoolH = PIPE_D + 10;
  const headW = 64;
  const headH = 28;
  const neck = 10;
  const headTop = y - spoolH / 2 - neck - headH;

  return (
    <div className={`flowmeter${active ? " is-on" : ""}`}>
      {[-1, 1].map((s) => (
        <div
          key={s}
          className="pipe-flange"
          style={{
            left: x + s * (spoolW / 2 + 2.5) - 2.5,
            top: y - (spoolH + 8) / 2,
            width: 5,
            height: spoolH + 8,
            zIndex: 5,
            borderRadius: 1.5,
            border: "1px solid var(--ink)",
            background: "var(--metal-h)",
          }}
        />
      ))}
      <div
        className="flowmeter__spool"
        style={{ left: x - spoolW / 2, top: y - spoolH / 2, width: spoolW, height: spoolH }}
      />
      <div
        className="flowmeter__neck"
        style={{ left: x - 5, top: y - spoolH / 2 - neck, height: neck + 1 }}
      />
      <div
        className="flowmeter__head"
        style={{ left: x - headW / 2, top: headTop, width: headW, height: headH }}
      >
        <div className="flowmeter__lcd">
          {value.toFixed(1)}
          <small>l/s</small>
        </div>
      </div>
      {tag && (
        <span className="scada-tag" style={{ left: x, top: y + spoolH / 2 + 6 }}>
          {tag}
        </span>
      )}
    </div>
  );
};
