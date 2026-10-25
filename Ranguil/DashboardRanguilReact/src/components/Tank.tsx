import React, { type CSSProperties, type ReactNode } from "react";

interface TankProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Nivel actual en metros. */
  level: number;
  /** Nivel que corresponde al estanque lleno, en metros. */
  maxLevel: number;
  /** Nivel de alarma baja en metros (opcional). */
  alarmLevel?: number;
  name: string;
  tag?: string;
  /** Posición X (relativa al estanque) por donde entra el agua desde el techo. */
  inletX?: number;
  /** Está entrando agua: muestra chorro, ondas y burbujas. */
  inflow?: boolean;
  /** Separación de marcas menores y rotuladas en la regla, en metros. */
  scaleStep: number;
  labelStep: number;
  children?: ReactNode;
}

const BUBBLES = [
  { dx: -6, size: 5, d: 2.2, delay: 0, sway: 3 },
  { dx: 5, size: 4, d: 2.6, delay: 0.7, sway: -3 },
  { dx: -2, size: 6, d: 3, delay: 1.3, sway: 4 },
  { dx: 9, size: 3, d: 2.4, delay: 1.9, sway: -2 },
];

const Tank: React.FC<TankProps> = ({
  x,
  y,
  width,
  height,
  level,
  maxLevel,
  alarmLevel,
  name,
  tag,
  inletX,
  inflow = false,
  scaleStep,
  labelStep,
  children,
}) => {
  const ry = Math.round(width * 0.08);
  const hc = height - 2 * ry;
  const safeMax = Math.max(maxLevel, 0.0001);
  const ratio = Math.max(0, level) / safeMax;
  const fill = Math.min(1, ratio);
  const yOf = (v: number) => hc * (1 - Math.min(1, Math.max(0, v / safeMax)));
  const inAlarm = alarmLevel !== undefined && level < alarmLevel;

  const vars = {
    left: x,
    top: y,
    width,
    height,
    "--ry": `${ry}px`,
    "--hc": `${hc}px`,
    "--offset": `${(hc * (1 - fill)).toFixed(2)}px`,
  } as CSSProperties;

  const ticks: ReactNode[] = [];
  const steps = Math.round(safeMax / scaleStep);
  const every = Math.max(1, Math.round(labelStep / scaleStep));
  for (let i = 0; i <= steps; i++) {
    const v = i * scaleStep;
    const major = i % every === 0;
    ticks.push(
      <div
        key={i}
        className={`tank__tick${major ? " tank__tick--major" : ""}`}
        style={{ top: yOf(v) }}
      />,
    );
    if (major) {
      ticks.push(
        <span key={`l${i}`} className="tank__tick-label" style={{ top: yOf(v) }}>
          {Number(v.toFixed(2))}
        </span>,
      );
    }
  }

  const rippleW = width * 0.5;
  const rippleH = rippleW * ((2 * ry) / width);

  return (
    <div
      className={`tank${inAlarm ? " tank--alarm" : ""}${fill <= 0.002 ? " tank--empty" : ""}`}
      style={vars}
    >
      <div className="tank__base" />

      <div className="tank__shell">
        {inletX !== undefined && (
          <div
            className={`tank__stream${inflow ? " is-on" : ""}`}
            style={{ left: inletX - 3.5 }}
          />
        )}

        <div className="tank__liquid">
          <div className="tank__surface">
            {inflow &&
              inletX !== undefined &&
              [0, 1, 2].map((k) => (
                <div
                  key={k}
                  className="tank__ripple"
                  style={{ left: inletX, width: rippleW, height: rippleH }}
                />
              ))}
          </div>
          {inflow &&
            inletX !== undefined &&
            BUBBLES.map((b, k) => (
              <div
                key={k}
                className="tank__bubble"
                style={
                  {
                    left: inletX + b.dx,
                    width: b.size,
                    height: b.size,
                    "--d": `${b.d}s`,
                    "--delay": `${b.delay}s`,
                    "--sway": `${b.sway}px`,
                  } as CSSProperties
                }
              />
            ))}
        </div>

        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="tank__seam" style={{ top: hc * f }} />
        ))}
        <div className="tank__hidden-line" />
        <div className="tank__shade" />
      </div>

      <div className="tank__outline" />
      <div className="tank__rim" />

      {alarmLevel !== undefined && (
        <div className="tank__alarm-line" style={{ top: ry + yOf(alarmLevel) }}>
          <span>L {alarmLevel.toFixed(1)} m</span>
        </div>
      )}

      <div className="tank__scale">
        {ticks}
        {alarmLevel !== undefined && (
          <div className="tank__tick tank__tick--alarm" style={{ top: yOf(alarmLevel) }} />
        )}
        <div className="tank__marker" />
      </div>

      {tag && (
        <span className="scada-tag" style={{ left: -26, top: ry - 24 }}>
          {tag}
        </span>
      )}

      <div className="tank__info" style={{ top: height + 18 }}>
        <div className="tank__name">{name}</div>
        <div className="tank__level">{level.toFixed(2)} m</div>
        <div className="tank__pct">{Math.round(ratio * 100)}%</div>
        {inAlarm && <span className="tank__badge">NIVEL BAJO</span>}
        {children}
      </div>
    </div>
  );
};

export default Tank;
