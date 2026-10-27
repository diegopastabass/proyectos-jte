import Card from "./Card";
import type { Sample } from "../types";
import { I_UNBALANCE_WARN, mean, unbalancePct } from "../lib/electrical";
import { polar } from "../lib/svg";

interface CurrentBalanceProps {
  sample: Sample | null;
  live: boolean;
  iNominal: number;
}

const AXES = [Math.PI / 2, Math.PI / 2 - (2 * Math.PI) / 3, Math.PI / 2 - (4 * Math.PI) / 3];

function CurrentBalance({ sample, live, iNominal }: CurrentBalanceProps) {
  const cx = 110;
  const cy = 105;
  const rMax = 75;

  const body = (() => {
    if (!sample) {
      return (
        <p className="text-body-secondary text-center my-5">
          Sin operación registrada en la ventana.
        </p>
      );
    }
    const scaleMax = Math.max(iNominal * 1.2, ...sample.i);
    const pt = (k: number, val: number) => polar(cx, cy, (val / scaleMax) * rMax, AXES[k]);
    const poly = (vals: number[]) =>
      vals.map((v, k) => `${pt(k, v).x.toFixed(1)},${pt(k, v).y.toFixed(1)}`).join(" ");
    const avg = mean(sample.i);
    const u = unbalancePct(sample.i);
    const ring = (f: number) =>
      AXES.map((a) => {
        const p = polar(cx, cy, rMax * f, a);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(" ");
    const nominalRing = Math.min(1, iNominal / scaleMax);

    return (
      <>
        <svg viewBox="0 0 220 210" width="100%" style={{ maxHeight: 230 }} role="img">
          <title>{`Corrientes: ${sample.i.map((x) => x.toFixed(1)).join(", ")} A`}</title>
          {[0.33, 0.66, 1].map((f) => (
            <polygon key={f} points={ring(f)} fill="none" stroke="var(--track)" strokeWidth={1} />
          ))}
          <polygon
            points={ring(nominalRing)}
            fill="none"
            stroke="var(--svg-line)"
            strokeDasharray="3 3"
          />
          {AXES.map((a, k) => {
            const e = polar(cx, cy, rMax, a);
            return <line key={k} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="var(--track)" />;
          })}
          <polygon
            points={poly([avg, avg, avg])}
            fill="none"
            stroke="var(--ok)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
          <polygon
            points={poly(sample.i)}
            fill="var(--accent)"
            fillOpacity={0.3}
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            style={{ transition: "all 0.6s ease" }}
          />
          {sample.i.map((val, k) => {
            const p = pt(k, val);
            const l = polar(cx, cy, rMax + 16, AXES[k]);
            return (
              <g key={k}>
                <circle cx={p.x} cy={p.y} r={4} fill="var(--accent)" />
                <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="currentColor">
                  L{k + 1} · {val.toFixed(1)} A
                </text>
              </g>
            );
          })}
        </svg>
        <div className="d-flex justify-content-between small text-body-secondary">
          <span>
            <span style={{ color: "var(--ok)" }}>┄</span> Balance perfecto ·{" "}
            <span>┄</span> Placa ({iNominal} A)
          </span>
          <span className={u > I_UNBALANCE_WARN ? "sev-warn fw-semibold" : "sev-ok fw-semibold"}>
            Desbalance {u.toFixed(1)} %
          </span>
        </div>
      </>
    );
  })();

  return (
    <Card className="panel">
      <div className="d-flex justify-content-between align-items-start">
        <div className="panel-title">
          <i className="bi bi-triangle me-1"></i>Balance de corrientes
        </div>
        {sample && (
          <span className={`badge ${live ? "text-bg-success" : "text-bg-secondary"}`}>
            {live
              ? "En operación"
              : `Última operación ${new Date(sample.t).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
          </span>
        )}
      </div>
      {body}
    </Card>
  );
}

export default CurrentBalance;
