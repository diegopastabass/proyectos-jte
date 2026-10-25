import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import "../lib/chartSetup";
import Card from "./Card";
import type { Sample } from "../types";
import { downsample, mean, V_OK_PCT } from "../lib/electrical";
import { chartTheme, useDarkTheme } from "../lib/useDarkTheme";

type Mode = "tension" | "corriente" | "potencia";
type Range = "24h" | "7d" | "15d";

const RANGE_MS: Record<Range, number> = {
  "24h": 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "15d": 15 * 24 * 3600 * 1000,
};

const MODES: Record<Mode, string> = {
  tension: "Tensión",
  corriente: "Corriente",
  potencia: "Potencia y caudal",
};

const PHASE_COLORS = ["#dc3545", "#198754", "#0d6efd"];
const MAX_POINTS = 480;

const averageBucket = (b: Sample[]): Sample => ({
  ...b[0],
  t: mean(b.map((s) => s.t)),
  v: [0, 1, 2].map((k) => mean(b.map((s) => s.v[k]))) as Sample["v"],
  i: [0, 1, 2].map((k) => mean(b.map((s) => s.i[k]))) as Sample["i"],
  iAvg: mean(b.map((s) => s.iAvg)),
  kva: mean(b.map((s) => s.kva)),
  q: (() => {
    const qs = b.filter((s) => s.q !== null).map((s) => s.q as number);
    return qs.length ? mean(qs) : null;
  })(),
});

interface TrendChartProps {
  samples: Sample[];
  vNominal: number;
}

function TrendChart({ samples, vNominal }: TrendChartProps) {
  const [mode, setMode] = useState<Mode>("tension");
  const [range, setRange] = useState<Range>("24h");
  const theme = chartTheme(useDarkTheme());

  const points = useMemo(() => {
    const end = samples.at(-1)?.t ?? 0;
    const win = samples.filter((s) => s.t >= end - RANGE_MS[range]);
    return downsample(win, MAX_POINTS, averageBucket);
  }, [samples, range]);

  // Inserta huecos (null) donde faltan datos para no unir tramos distantes
  const series = (get: (s: Sample) => number | null) => {
    const step = points.length > 1 ? (points.at(-1)!.t - points[0].t) / (points.length - 1) : 0;
    const gap = Math.max(20 * 60 * 1000, step * 3);
    const out: { x: number; y: number | null }[] = [];
    points.forEach((s, k) => {
      if (k > 0 && s.t - points[k - 1].t > gap) {
        out.push({ x: points[k - 1].t + 1, y: null });
      }
      out.push({ x: s.t, y: get(s) });
    });
    return out;
  };

  const line = (label: string, color: string, get: (s: Sample) => number | null) => ({
    label,
    data: series(get),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 0,
    pointHitRadius: 8,
    tension: 0.25,
  });

  const guide = (label: string, y: number, color: string) => ({
    label,
    data: points.length
      ? [
          { x: points[0].t, y },
          { x: points.at(-1)!.t, y },
        ]
      : [],
    borderColor: color,
    borderDash: [6, 4],
    borderWidth: 1,
    pointRadius: 0,
    pointHitRadius: 0,
  });

  const data: ChartData<"line", { x: number; y: number | null }[]> = {
    datasets:
      mode === "tension"
        ? [
            ...[0, 1, 2].map((k) => line(`L${k + 1}`, PHASE_COLORS[k], (s) => s.v[k])),
            guide("_hi", vNominal * (1 + V_OK_PCT / 100), "rgba(224,168,0,0.9)"),
            guide("_lo", vNominal * (1 - V_OK_PCT / 100), "rgba(224,168,0,0.9)"),
          ]
        : mode === "corriente"
          ? [0, 1, 2].map((k) => line(`L${k + 1}`, PHASE_COLORS[k], (s) => s.i[k]))
          : [
              {
                ...line("Potencia aparente (kVA)", "#0d6efd", (s) => s.kva),
                fill: true,
                backgroundColor: "rgba(13,110,253,0.18)",
                yAxisID: "y",
              },
              {
                ...line("Caudal (l/s)", "#20c997", (s) => s.q),
                yAxisID: "y1",
              },
            ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        labels: {
          color: theme.text,
          filter: (item) => !item.text.startsWith("_"),
        },
      },
      tooltip: { filter: (item) => !item.dataset.label?.startsWith("_") },
    },
    scales: {
      x: {
        type: "time",
        time: {
          tooltipFormat: "dd-MM HH:mm",
          displayFormats: { hour: "HH:mm", day: "dd-MM", minute: "HH:mm" },
        },
        ticks: { color: theme.text, maxRotation: 0, autoSkipPadding: 20 },
        grid: { color: theme.grid },
      },
      y: {
        position: "left",
        ticks: { color: theme.text },
        grid: { color: theme.grid },
        ...(mode === "tension"
          ? { suggestedMin: vNominal * 0.9, suggestedMax: vNominal * 1.1 }
          : { beginAtZero: true }),
      },
      ...(mode === "potencia"
        ? {
            y1: {
              position: "right" as const,
              beginAtZero: true,
              ticks: { color: theme.text },
              grid: { drawOnChartArea: false },
            },
          }
        : {}),
    },
  };

  return (
    <Card className="panel">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div className="panel-title mb-0">
          <i className="bi bi-graph-up me-1"></i>Tendencias eléctricas
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <div className="btn-group btn-group-sm" role="group" aria-label="Variable">
            {(Object.keys(MODES) as Mode[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${mode === k ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setMode(k)}
              >
                {MODES[k]}
              </button>
            ))}
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Rango">
            {(Object.keys(RANGE_MS) as Range[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${range === k ? "btn-secondary" : "btn-outline-secondary"}`}
                onClick={() => setRange(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ height: 280 }}>
        <Line data={data} options={options} />
      </div>
    </Card>
  );
}

export default TrendChart;
