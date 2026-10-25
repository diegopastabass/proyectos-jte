import Card from "./Card";
import {
  V_OK_PCT,
  V_WARN_PCT,
  voltageDeviationPct,
  voltageSeverity,
  unbalancePct,
} from "../lib/electrical";
import { arcPath, polar } from "../lib/svg";

const RANGE_PCT = 15; // la escala cubre nominal ± 15 %

interface GaugeProps {
  label: string;
  value: number;
  nominal: number;
}

function Gauge({ label, value, nominal }: GaugeProps) {
  const cx = 80;
  const cy = 80;
  const r = 62;
  const min = nominal * (1 - RANGE_PCT / 100);
  const max = nominal * (1 + RANGE_PCT / 100);
  const angle = (v: number) =>
    Math.PI - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * Math.PI;

  const at = (pct: number) => nominal * (1 + pct / 100);
  const segments = [
    { a: min, b: at(-V_WARN_PCT), color: "var(--bad)" },
    { a: at(-V_WARN_PCT), b: at(-V_OK_PCT), color: "var(--warn)" },
    { a: at(-V_OK_PCT), b: at(V_OK_PCT), color: "var(--ok)" },
    { a: at(V_OK_PCT), b: at(V_WARN_PCT), color: "var(--warn)" },
    { a: at(V_WARN_PCT), b: max, color: "var(--bad)" },
  ];

  const needle = polar(cx, cy, r - 8, angle(value));
  const dev = voltageDeviationPct(value, nominal);
  const sev = voltageSeverity(value, nominal);

  return (
    <div className="text-center">
      <svg viewBox="0 0 160 100" width="100%" style={{ maxWidth: 170 }} role="img">
        <title>{`${label}: ${value.toFixed(1)} V`}</title>
        {segments.map((s, k) => (
          <path
            key={k}
            d={arcPath(cx, cy, r, angle(s.a), angle(s.b))}
            stroke={s.color}
            strokeWidth={12}
            fill="none"
            opacity={0.85}
          />
        ))}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          style={{ transition: "all 0.6s ease" }}
        />
        <circle cx={cx} cy={cy} r={6} fill="currentColor" />
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={15} fontWeight={700} fill="currentColor">
          {value.toFixed(1)} V
        </text>
      </svg>
      <div className="fw-semibold">{label}</div>
      <div className={`small sev-${sev}`}>
        {dev >= 0 ? "+" : ""}
        {dev.toFixed(1)} % vs nominal
      </div>
    </div>
  );
}

interface VoltageGaugesProps {
  v: [number, number, number];
  nominal: number;
}

function VoltageGauges({ v, nominal }: VoltageGaugesProps) {
  const u = unbalancePct(v);
  return (
    <Card className="panel">
      <div className="d-flex justify-content-between align-items-start">
        <div className="panel-title">
          <i className="bi bi-lightning-charge me-1"></i>Tensión por fase
        </div>
        <span className={`badge ${u > 2 ? "text-bg-warning" : "text-bg-success"}`}>
          Desbalance {u.toFixed(2)} %
        </span>
      </div>
      <div className="row g-1">
        {v.map((val, k) => (
          <div className="col-4" key={k}>
            <Gauge label={`L${k + 1}`} value={val} nominal={nominal} />
          </div>
        ))}
      </div>
      <div className="small text-body-secondary text-center mt-2">
        Nominal {nominal} V · verde ±{V_OK_PCT} % · ámbar ±{V_WARN_PCT} %
      </div>
    </Card>
  );
}

export default VoltageGauges;
