import React, { type CSSProperties } from "react";

export type Point = [number, number];

interface PipeProps {
  /** Recorrido de la línea (eje de la tubería), sólo tramos horizontales/verticales. */
  points: Point[];
  /** La tubería está llena de agua. */
  water?: boolean;
  /** El agua circula (anima pulsos en el sentido de `points`). */
  flowing?: boolean;
  /** Velocidad aparente del flujo en px/s. */
  speed?: number;
  /** Radio de los codos medido en el eje de la tubería. */
  radius?: number;
}

export const PIPE_D = 16;
const BORE = 8;
const PERIOD = 24;
const FLANGE_T = 5;
const FLANGE_D = PIPE_D + 6;

type Stops = [string, number][];

const METAL: Stops = [
  ["#3a4047", 0],
  ["#3a4047", 0.06],
  ["#737b83", 0.07],
  ["#b4bbc1", 0.26],
  ["#f1f3f5", 0.45],
  ["#c8ced3", 0.62],
  ["#7c848b", 0.88],
  ["#3a4047", 0.93],
  ["#3a4047", 1],
];

const WATER: Stops = [
  ["#073f4d", 0],
  ["#1a93ab", 0.42],
  ["#0e6b80", 0.75],
  ["#063846", 1],
];

const EMPTY: Stops = [
  ["#2c3238", 0],
  ["#4a525a", 0.45],
  ["#2c3238", 1],
];

const PULSE: Stops = [
  ["rgba(220,248,255,0)", 0],
  ["rgba(220,248,255,0)", 0.25],
  ["rgba(220,248,255,0.7)", 0.5],
  ["rgba(220,248,255,0)", 0.75],
  ["rgba(220,248,255,0)", 1],
];

/** Convierte paradas relativas (0..1) a px entre r0 y r1. */
const px = (list: Stops, r0: number, r1: number) =>
  list.map(([c, f]) => `${c} ${(r0 + (r1 - r0) * f).toFixed(2)}px`).join(", ");

const ring = (list: Stops, at: string, r0: number, r1: number) =>
  `radial-gradient(circle at ${at}, transparent ${r0 - 0.6}px, ${px(list, r0, r1)}, transparent ${r1 + 0.6}px)`;

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const dirOf = (a: Point, b: Point): Point => [sign(b[0] - a[0]), sign(b[1] - a[1])];

const Pipe: React.FC<PipeProps> = ({
  points,
  water = true,
  flowing = false,
  speed = 40,
  radius = 24,
}) => {
  const R = radius;
  const bore = water ? WATER : EMPTY;
  const flowVars = {
    "--period": `${PERIOD}px`,
    "--flow-t": `${(PERIOD / Math.max(speed, 1)).toFixed(3)}s`,
  } as CSSProperties;

  const parts: React.ReactNode[] = [];

  const flange = (key: string, at: Point, horizontalPipe: boolean) => {
    const w = horizontalPipe ? FLANGE_T : FLANGE_D;
    const h = horizontalPipe ? FLANGE_D : FLANGE_T;
    parts.push(
      <div
        key={key}
        className="pipe-flange"
        style={{
          left: at[0] - w / 2,
          top: at[1] - h / 2,
          width: w,
          height: h,
          zIndex: 4,
          borderRadius: 1.5,
          background: `linear-gradient(${horizontalPipe ? 180 : 90}deg, ${px(METAL, 0, FLANGE_D)})`,
        }}
      />,
    );
  };

  // Tramos rectos
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const [dx, dy] = dirOf(a, b);
    const horizontal = dy === 0;
    const start: Point = i > 0 ? [a[0] + dx * R, a[1] + dy * R] : a;
    const end: Point = i < points.length - 2 ? [b[0] - dx * R, b[1] - dy * R] : b;

    const left = Math.min(start[0], end[0]) - (horizontal ? 0 : PIPE_D / 2);
    const top = Math.min(start[1], end[1]) - (horizontal ? PIPE_D / 2 : 0);
    const length = Math.abs(horizontal ? end[0] - start[0] : end[1] - start[1]);
    const across = horizontal ? 180 : 90;
    const along = horizontal ? 90 : 180;
    const inset = (PIPE_D - BORE) / 2;

    parts.push(
      <div
        key={`s${i}`}
        className={`pipe${flowing ? " is-flowing" : ""}`}
        style={{
          left,
          top,
          width: horizontal ? length : PIPE_D,
          height: horizontal ? PIPE_D : length,
          background: `linear-gradient(${across}deg, ${px(METAL, 0, PIPE_D)})`,
          ...flowVars,
        }}
      >
        <div
          className="pipe__bore"
          style={{
            ...(horizontal
              ? { left: 0, right: 0, top: inset, height: BORE }
              : { top: 0, bottom: 0, left: inset, width: BORE }),
            background: `linear-gradient(${across}deg, ${px(bore, 0, BORE)})`,
          }}
        >
          {water && (
            <div
              className={`pipe__flow pipe__flow--${horizontal ? "x" : "y"}${
                dx + dy < 0 ? " pipe__flow--rev" : ""
              }`}
              style={{
                background: `repeating-linear-gradient(${along}deg, ${px(PULSE, 0, PERIOD)})`,
              }}
            />
          )}
        </div>
      </div>,
    );

    if (i === 0) flange("f-start", start, horizontal);
    if (i === points.length - 2) flange("f-end", end, horizontal);
  }

  // Codos de 90°
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i];
    const d1 = dirOf(points[i - 1], c);
    const d2 = dirOf(c, points[i + 1]);
    const S = R + PIPE_D / 2;
    // Centro de curvatura
    const ox = c[0] - d1[0] * R + d2[0] * R;
    const oy = c[1] - d1[1] * R + d2[1] * R;
    // El cuadrante del codo queda entre los vectores d1 y -d2 desde el centro
    const vx = d1[0] - d2[0];
    const vy = d1[1] - d2[1];
    const left = vx > 0 ? ox : ox - S;
    const top = vy > 0 ? oy : oy - S;
    const cx = vx > 0 ? 0 : S;
    const cy = vy > 0 ? 0 : S;
    const at = `${cx}px ${cy}px`;

    // Pulsos que giran alrededor del centro a la misma velocidad lineal
    const n = Math.max(4, Math.round((2 * Math.PI * R) / PERIOD));
    const theta = 360 / n;
    const clockwise = d1[0] * d2[1] - d1[1] * d2[0] > 0;
    const pulse = PULSE.map(([col, f]) => `${col} ${(f * theta).toFixed(2)}deg`).join(", ");
    const r0 = R - BORE / 2;
    const r1 = R + BORE / 2;

    parts.push(
      <div
        key={`e${i}`}
        className={`pipe-elbow${flowing ? " is-flowing" : ""}`}
        style={{
          left,
          top,
          width: S,
          height: S,
          background: `${ring(bore, at, r0, r1)}, ${ring(METAL, at, R - PIPE_D / 2, S)}`,
          ...flowVars,
        }}
      >
        {water && (
          <div
            className={`pipe__flow pipe-elbow__flow${clockwise ? "" : " pipe__flow--rev"}`}
            style={
              {
                left: cx - S,
                top: cy - S,
                width: 2 * S,
                height: 2 * S,
                "--theta": `${theta}deg`,
                background: `repeating-conic-gradient(from 0deg, ${pulse})`,
                WebkitMaskImage: `radial-gradient(circle, transparent ${r0}px, #000 ${r0 + 0.5}px, #000 ${r1 - 0.5}px, transparent ${r1}px)`,
                maskImage: `radial-gradient(circle, transparent ${r0}px, #000 ${r0 + 0.5}px, #000 ${r1 - 0.5}px, transparent ${r1}px)`,
              } as CSSProperties
            }
          />
        )}
      </div>,
    );

    flange(`f${i}a`, [c[0] - d1[0] * R, c[1] - d1[1] * R], d1[1] === 0);
    flange(`f${i}b`, [c[0] + d2[0] * R, c[1] + d2[1] * R], d2[1] === 0);
  }

  return <>{parts}</>;
};

/** Distancia del eje de la línea principal al borde de la salida lateral de una T. */
export const TEE_HALF = 20;

interface PipeTeeProps {
  /** Punto del eje de la línea principal donde sale el ramal. */
  x: number;
  y: number;
  /** Lado por el que sale el ramal. El ramal debe empezar o terminar a TEE_HALF del eje. */
  branch: "left" | "right" | "up" | "down";
}

/**
 * Conexión en T: cuerpo de fitting sobre la línea principal, salida lateral y
 * bridas en los extremos del tramo recto. Va encima de las tuberías, así que
 * tapa las uniones de los tramos que empiezan o terminan en (x, y).
 */
export const PipeTee: React.FC<PipeTeeProps> = ({ x, y, branch }) => {
  const runVertical = branch === "left" || branch === "right";
  const body = PIPE_D + 2;
  const metal = (deg: number) => `linear-gradient(${deg}deg, ${px(METAL, 0, body)})`;
  const flangeStyle = (cx: number, cy: number, horizontalRun: boolean): CSSProperties => {
    const w = horizontalRun ? FLANGE_T : FLANGE_D;
    const h = horizontalRun ? FLANGE_D : FLANGE_T;
    return {
      left: cx - w / 2,
      top: cy - h / 2,
      width: w,
      height: h,
      borderRadius: 1.5,
      background: `linear-gradient(${horizontalRun ? 180 : 90}deg, ${px(METAL, 0, FLANGE_D)})`,
    };
  };

  // Salida lateral: desde el eje hasta TEE_HALF hacia el lado del ramal
  const sx = branch === "right" ? 1 : branch === "left" ? -1 : 0;
  const sy = branch === "down" ? 1 : branch === "up" ? -1 : 0;
  const outlet: CSSProperties = runVertical
    ? { left: sx > 0 ? x : x - TEE_HALF, top: y - body / 2, width: TEE_HALF, height: body, background: metal(180) }
    : { left: x - body / 2, top: sy > 0 ? y : y - TEE_HALF, width: body, height: TEE_HALF, background: metal(90) };

  // Cuerpo sobre la línea principal
  const run: CSSProperties = runVertical
    ? { left: x - body / 2, top: y - TEE_HALF, width: body, height: 2 * TEE_HALF, background: metal(90) }
    : { left: x - TEE_HALF, top: y - body / 2, width: 2 * TEE_HALF, height: body, background: metal(180) };

  return (
    <div className="pipe-tee">
      <div className="pipe-tee__part" style={outlet} />
      <div className="pipe-tee__part" style={run} />
      {runVertical ? (
        <>
          <div className="pipe-tee__part" style={flangeStyle(x, y - TEE_HALF, false)} />
          <div className="pipe-tee__part" style={flangeStyle(x, y + TEE_HALF, false)} />
        </>
      ) : (
        <>
          <div className="pipe-tee__part" style={flangeStyle(x - TEE_HALF, y, true)} />
          <div className="pipe-tee__part" style={flangeStyle(x + TEE_HALF, y, true)} />
        </>
      )}
    </div>
  );
};

export default Pipe;
