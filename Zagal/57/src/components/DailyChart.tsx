import { useEffect, useRef, useState } from "react";
import { formatDate } from "../lib/dates";
import { formatDuration, formatNumber } from "../lib/format";
import type { DayPoint } from "../lib/metrics";

export type DailyMetric = "hours" | "volume";

interface DailyChartProps {
  points: DayPoint[];
  metric: DailyMetric;
  /** Días totales del mes, para que el ancho de barra no cambie a mitad de mes */
  totalDays: number;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 44 };

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

// Escala "bonita": 4 divisiones con pasos 1/2/2.5/5 x 10^n
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.25 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: step * 4, step };
}

function DailyChart({ points, metric, totalDays }: DailyChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const valueOf = (p: DayPoint) => (metric === "hours" ? p.seconds / 3600 : p.volume);
  const { top, step } = niceMax(Math.max(0, ...points.map(valueOf)));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = totalDays > 0 ? plotW / totalDays : 0;
  const gap = Math.min(4, slot * 0.25); // separación de superficie entre barras
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const ticks = Array.from({ length: 5 }, (_, i) => i * step);
  const labelEvery = slot < 18 ? 5 : slot < 28 ? 2 : 1;
  const unit = metric === "hours" ? "h" : "m³";
  const tickDigits = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2;
  const fmtTick = (v: number) => formatNumber(v, tickDigits);
  const isEmpty = points.every((p) => valueOf(p) <= 0);

  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {isEmpty && (
        <div className="d-flex align-items-center justify-content-center text-muted small" style={{ height: HEIGHT }}>
          Sin {metric === "hours" ? "riego" : "volumen"} registrado en el periodo
        </div>
      )}
      {width > 0 && !isEmpty && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`Riego diario en ${unit}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}
                strokeWidth={1}
              />
              <text className="chart__tick" x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {fmtTick(t)}
              </text>
            </g>
          ))}

          {points.map((p, i) => {
            const v = valueOf(p);
            const x = PAD.left + i * slot + gap / 2;
            const h = Math.max(0, y(0) - y(v));
            const day = Number(p.date.slice(8, 10));
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={p.date}>
                {h > 0 && (
                  // Extremo superior redondeado, base recta sobre el eje
                  <path
                    d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) + r} V${y(0)} Z`}
                    fill={hover === i ? "var(--viz-series-1-hover)" : "var(--viz-series-1)"}
                  />
                )}
                {(day === 1 || day % labelEvery === 0) && (
                  <text className="chart__tick" x={x + barW / 2} y={HEIGHT - 6} textAnchor="middle">
                    {day}
                  </text>
                )}
                {/* Zona de hover de toda la columna, más grande que la barra */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="chart__tooltip"
          style={{
            left: Math.min(Math.max(PAD.left + hover * slot + slot / 2, 80), width - 80),
            top: y(valueOf(hovered)),
          }}
        >
          <strong>{formatDate(hovered.date)}</strong>
          Riego: {hovered.seconds > 0 ? formatDuration(hovered.seconds) : "sin riego"}
          <br />
          Volumen: {formatNumber(hovered.volume, 1)} m³
          {hovered.avgCaudal !== null && (
            <>
              <br />
              Caudal prom.: {formatNumber(hovered.avgCaudal, 1)} l/s
            </>
          )}
        </div>
      )}

      <details className="chart-table">
        <summary>Ver como tabla</summary>
        <div className="table-scroll" style={{ maxHeight: 260 }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Riego</th>
                <th className="num">Volumen m³</th>
                <th className="num">Caudal l/s</th>
              </tr>
            </thead>
            <tbody>
              {points
                .filter((p) => p.seconds > 0 || p.volume > 0)
                .map((p) => (
                  <tr key={p.date}>
                    <td>{formatDate(p.date)}</td>
                    <td className="num">{formatDuration(p.seconds)}</td>
                    <td className="num">{formatNumber(p.volume, 1)}</td>
                    <td className="num">{p.avgCaudal !== null ? formatNumber(p.avgCaudal, 1) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default DailyChart;
