import Card from "./Card";
import type { Finding } from "../types";

const ICON = {
  ok: "bi-check-circle-fill sev-ok",
  warn: "bi-exclamation-triangle-fill sev-warn",
  bad: "bi-x-octagon-fill sev-bad",
} as const;

interface DiagnosticsCardProps {
  findings: Finding[];
}

function DiagnosticsCard({ findings }: DiagnosticsCardProps) {
  return (
    <Card className="panel">
      <div className="panel-title">
        <i className="bi bi-activity me-1"></i>Diagnóstico automático
      </div>
      <div style={{ maxHeight: 250, overflowY: "auto" }}>
        {findings.map((f, k) => (
          <div key={k} className={`finding ${f.severity}`}>
            <div className="fw-semibold">
              <i className={`bi ${ICON[f.severity]} me-1`}></i>
              {f.title}
            </div>
            <div className="small text-body-secondary">{f.detail}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default DiagnosticsCard;
