import { useMemo, useState } from "react";
import Card from "./Card";
import type { Sample } from "../types";
import { mean } from "../lib/electrical";
import { formatDayShort } from "../lib/time";

type HeatMetric = "kva" | "iAvg" | "run";

const METRICS: Record<
  HeatMetric,
  { label: string; unit: string; digits: number }
> = {
  kva: { label: "Potencia", unit: "kVA", digits: 1 },
  iAvg: { label: "Corriente", unit: "A", digits: 1 },
  run: { label: "Operación", unit: "%", digits: 0 },
};

interface HeatmapCardProps {
  samples: Sample[];
}

function HeatmapCard({ samples }: HeatmapCardProps) {
  const [metric, setMetric] = useState<HeatMetric>("kva");

  const { days, grid, max } = useMemo(() => {
    const acc = new Map<string, number[][]>();
    for (const s of samples) {
      let row = acc.get(s.day);
      if (!row) {
        row = Array.from({ length: 24 }, () => [] as number[]);
        acc.set(s.day, row);
      }
      const val =
        metric === "run" ? (s.running ? 100 : 0) : (s[metric] as number);
      row[s.hour].push(val);
    }
    const days = [...acc.keys()].sort().reverse();
    let max = 0;
    const grid = days.map((d) =>
      acc.get(d)!.map((vals) => {
        if (vals.length === 0) return null;
        const m = mean(vals);
        max = Math.max(max, m);
        return m;
      }),
    );
    return { days, grid, max };
  }, [samples, metric]);

  const { unit, digits } = METRICS[metric];

  return (
    <Card className="panel">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div className="panel-title mb-0">
          <i className="bi bi-grid-3x3-gap me-1"></i>Mapa de calor hora × día
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Variable">
          {(Object.keys(METRICS) as HeatMetric[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`btn ${metric === k ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setMetric(k)}
            >
              {METRICS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="heatmap">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="hlbl">
            {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
          </div>
        ))}
        {days.map((d, r) => (
          <HeatRow
            key={d}
            day={d}
            values={grid[r]}
            max={max}
            unit={unit}
            digits={digits}
          />
        ))}
      </div>

      <div className="d-flex align-items-center gap-2 mt-3 small text-body-secondary">
        <span>0</span>
        <div
          style={{
            flex: "0 0 160px",
            height: 8,
            borderRadius: 4,
            background:
              "linear-gradient(to right, var(--track), rgba(13,110,253,0.95))",
          }}
        />
        <span>
          {max.toFixed(digits)} {unit}
        </span>
        <span className="ms-auto">Horas en hora local de Santiago</span>
      </div>
    </Card>
  );
}

interface HeatRowProps {
  day: string;
  values: (number | null)[];
  max: number;
  unit: string;
  digits: number;
}

function HeatRow({ day, values, max, unit, digits }: HeatRowProps) {
  return (
    <>
      <div className="lbl">{formatDayShort(day)}</div>
      {values.map((v, h) => (
        <div
          key={h}
          className="cell"
          title={
            v === null
              ? `${day} ${String(h).padStart(2, "0")}:00 — sin datos`
              : `${day} ${String(h).padStart(2, "0")}:00 — ${v.toFixed(digits)} ${unit}`
          }
          style={
            v === null || max <= 0
              ? undefined
              : { background: `rgba(13,110,253,${0.1 + 0.85 * (v / max)})` }
          }
        />
      ))}
    </>
  );
}

export default HeatmapCard;
