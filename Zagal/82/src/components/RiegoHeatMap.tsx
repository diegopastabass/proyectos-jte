import { useMemo, useState } from "react";
import styles from "./styles/HeatMap.module.css";
import InfoModal from "./InfoModal";
import { formatDate } from "../lib/dates";
import { formatDuration, formatNumber } from "../lib/format";
import type { DayPoint } from "../lib/metrics";

interface HeatMapProps {
  /** Un punto por día del mes (hasta hoy si es el mes en curso) */
  points: DayPoint[];
  month: string;
  scopeLabel: string;
}

// Rangos de tiempo diario de riego (segundos) para la escala de color
const BINS = [
  { max: 10, cls: styles.color0, label: "Sin riego" },
  { max: 600, cls: styles.color1, label: "< 10 min" },
  { max: 3600, cls: styles.color2, label: "< 1 h" },
  { max: 14400, cls: styles.color3, label: "< 4 h" },
  { max: Infinity, cls: styles.color4, label: "≥ 4 h" },
];

const colorFor = (seconds: number | null) =>
  BINS.find((b) => (seconds ?? 0) < b.max)!.cls;

const shortDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}` : `${m}m`;
};

const weekDays = ["L", "M", "Mi", "J", "V", "S", "D"];

function HeatMap({ points, month, scopeLabel }: HeatMapProps) {
  const [modalDay, setModalDay] = useState<DayPoint | null>(null);

  const weeks = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstDay = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const byDate = new Map(points.map((p) => [p.date, p]));

    const cells: (DayPoint | { date: string; future: true } | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      cells.push(byDate.get(date) ?? { date, future: true });
    }
    while (cells.length % 7) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [points, month]);

  return (
    <div className={styles.container}>
      <div className={styles.weekRow}>
        {weekDays.map((d) => (
          <div key={d} className={styles.weekDayLabel}>
            {d}
          </div>
        ))}
        <div className={styles.weekDayLabel} title="Total de la semana">
          Σ
        </div>
      </div>

      {weeks.map((week, w) => {
        const weekSeconds = week.reduce(
          (s, c) => s + (c && "seconds" in c ? c.seconds : 0),
          0,
        );
        return (
          <div key={w} className={styles.weekRow}>
            {week.map((cell, i) => {
              if (!cell) return <div key={i} className={styles.emptyCell} />;
              const day = Number(cell.date.slice(8, 10));
              if ("future" in cell) {
                return (
                  <div key={i} className={`${styles.dayCell} ${styles.future}`}>
                    {day}
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.dayCell} ${colorFor(cell.seconds)}`}
                  title={`${formatDate(cell.date)} · ${cell.seconds > 0 ? formatDuration(cell.seconds) : "sin riego"}`}
                  onClick={() => setModalDay(cell)}
                >
                  <span className={styles.dayNum}>{day}</span>
                  {cell.seconds >= 60 && (
                    <span className={styles.irrigationTime}>{shortDuration(cell.seconds)}</span>
                  )}
                </button>
              );
            })}
            <div className={styles.weekSummary} title="Total de la semana">
              {weekSeconds >= 60 ? shortDuration(weekSeconds) : "–"}
            </div>
          </div>
        );
      })}

      <div className={styles.legend} aria-label="Escala de tiempo de riego diario">
        {BINS.map((b) => (
          <span key={b.label}>
            <i className={b.cls} aria-hidden="true" />
            {b.label}
          </span>
        ))}
      </div>

      <InfoModal
        show={modalDay !== null}
        onClose={() => setModalDay(null)}
        title={modalDay ? `Riego del ${formatDate(modalDay.date)}` : ""}
        text1={`Sector: ${scopeLabel}`}
        text2={`Tiempo total de riego: ${modalDay && modalDay.seconds > 0 ? formatDuration(modalDay.seconds) : "No hubo riego"}`}
        text3={`Volumen: ${modalDay ? formatNumber(modalDay.volume, 1) : 0} m³`}
        text4={`Caudal promedio: ${modalDay?.avgCaudal != null ? `${formatNumber(modalDay.avgCaudal, 1)} l/s` : "N/A"}`}
      />
    </div>
  );
}

export default HeatMap;
