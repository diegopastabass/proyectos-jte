import Card from "./Card";
import type { Health } from "../lib/electrical";

const COLOR = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--bad)",
} as const;

const scoreSeverity = (score: number) =>
  score >= 85 ? "ok" : score >= 65 ? "warn" : "bad";

interface HealthScoreProps {
  health: Health;
}

function HealthScore({ health }: HealthScoreProps) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, health.total / 100));
  const color = COLOR[health.severity];

  return (
    <Card className="panel">
      <div className="panel-title">
        <i className="bi bi-heart-pulse me-1"></i>Salud del equipo
      </div>
      <div className="d-flex flex-wrap align-items-center justify-content-center gap-3">
        <svg viewBox="0 0 140 140" width={140} height={140} role="img">
          <title>{`Puntaje de salud ${health.total.toFixed(0)} de 100`}</title>
          <circle
            cx={70}
            cy={70}
            r={r}
            fill="none"
            stroke="var(--track)"
            strokeWidth={14}
          />
          <circle
            cx={70}
            cy={70}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${circ * frac} ${circ}`}
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
          <text
            x={70}
            y={70}
            textAnchor="middle"
            fontSize={34}
            fontWeight={700}
            fill="currentColor"
          >
            {health.total.toFixed(0)}
          </text>
          <text
            x={70}
            y={94}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill={color}
          >
            {health.label}
          </text>
        </svg>
        <div className="flex-grow-1" style={{ minWidth: 200 }}>
          {health.items.map((it) => (
            <div key={it.key} className="mb-2">
              <div className="d-flex justify-content-between small">
                <span>{it.label}</span>
                <span className="text-body-secondary">{it.detail}</span>
              </div>
              <div className="mini-bar">
                <div
                  style={{
                    width: `${it.score}%`,
                    background: COLOR[scoreSeverity(it.score)],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default HealthScore;
