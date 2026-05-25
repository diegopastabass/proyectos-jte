interface VpdBadgeProps {
  vpd: number;
}

/**
 * Rangos estándar de VPD para vivero (en kPa):
 *  < 0.8   → Baja Transpiración (azul)
 *  0.8–1.2 → Óptimo            (verde)
 *  > 1.2   → Estrés Hídrico    (rojo)
 */
function getVpdInfo(vpd: number): {
  label: string;
  badgeClass: string;
} {
  if (vpd < 0.8) {
    return {
      label: "Baja Transpiración",
      badgeClass: "bg-primary",
    };
  }
  if (vpd > 1.2) {
    return {
      label: "Estrés Hídrico",
      badgeClass: "bg-danger",
    };
  }
  return {
    label: "Óptimo",
    badgeClass: "bg-success",
  };
}

export default function VpdBadge({ vpd }: VpdBadgeProps) {
  const { label, badgeClass } = getVpdInfo(vpd);

  return (
    <div className="d-flex align-items-center gap-2 mt-2">
      <small className="text-secondary fw-semibold">VPD</small>
      <span className="fw-bold">{vpd.toFixed(2)} kPa</span>
      <span className={`badge ${badgeClass}`}>{label}</span>
    </div>
  );
}
