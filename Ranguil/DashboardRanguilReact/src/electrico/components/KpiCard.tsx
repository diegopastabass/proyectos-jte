import Card from "./Card";
import Sparkline from "./Sparkline";

interface KpiCardProps {
  icon: string;
  title: string;
  value: string;
  unit?: string;
  sub?: string;
  // Variación porcentual contra el promedio de la ventana
  trendPct?: number | null;
  // "down": que baje es bueno (costo, consumo). "up": que suba es bueno.
  goodWhen?: "up" | "down" | "none";
  spark?: number[];
}

function KpiCard({
  icon,
  title,
  value,
  unit,
  sub,
  trendPct,
  goodWhen = "none",
  spark,
}: KpiCardProps) {
  let trendClass = "flat";
  let arrow = "bi-dash";
  if (trendPct !== null && trendPct !== undefined && Math.abs(trendPct) >= 1) {
    const up = trendPct > 0;
    arrow = up ? "bi-arrow-up-right" : "bi-arrow-down-right";
    if (goodWhen === "none") trendClass = "flat";
    else trendClass = `${up ? "up" : "down"}-${(up ? "up" : "down") === goodWhen ? "good" : "bad"}`;
  }

  return (
    <Card className="panel">
      <div className="panel-title">
        <i className={`bi ${icon} me-1`}></i>
        {title}
      </div>
      <div>
        <span className="kpi-value">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="d-flex justify-content-between align-items-center mt-1">
        <span className="small text-body-secondary">{sub}</span>
        {trendPct !== null && trendPct !== undefined && (
          <span className={`kpi-trend ${trendClass}`}>
            <i className={`bi ${arrow}`}></i> {Math.abs(trendPct).toFixed(0)} %
          </span>
        )}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-2">
          <Sparkline values={spark} />
        </div>
      )}
    </Card>
  );
}

export default KpiCard;
