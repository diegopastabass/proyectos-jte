import React, { useEffect, useState } from "react";

interface DataArrivalIndicatorProps {
  label: string;
  latestTime: string | undefined;
  /** Compact mode for embedding inside SCADA diagram */
  compact?: boolean;
}

type StatusLevel = "ok" | "warning" | "critical" | "unknown";

const STATUS_CONFIG: Record<
  StatusLevel,
  { color: string; bg: string; border: string; label: string; icon: string }
> = {
  ok: {
    color: "#15803d",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    label: "Datos al día",
    icon: "●",
  },
  warning: {
    color: "#b45309",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    label: "Datos retrasados",
    icon: "●",
  },
  critical: {
    color: "#dc2626",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    label: "Sin datos recientes",
    icon: "●",
  },
  unknown: {
    color: "#6b7280",
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.35)",
    label: "Sin información",
    icon: "○",
  },
};

function getStatus(latestTime: string | undefined): StatusLevel {
  if (!latestTime) return "unknown";

  const now = new Date();
  const dataTime = new Date(latestTime);
  const diffMs = now.getTime() - dataTime.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes <= 30) return "ok";
  if (diffMinutes <= 60) return "warning";
  return "critical";
}

function formatTime(latestTime: string | undefined): string {
  if (!latestTime) return "—";
  const d = new Date(latestTime);
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

const DataArrivalIndicator: React.FC<DataArrivalIndicatorProps> = ({
  label,
  latestTime,
  compact = false,
}) => {
  // Force re-render every 30s so the status color updates in real time
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const status = getStatus(latestTime);
  const cfg = STATUS_CONFIG[status];
  const timeStr = formatTime(latestTime);

  if (compact) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 10px",
          borderRadius: "6px",
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          fontSize: "0.75rem",
          fontWeight: 500,
          lineHeight: 1.3,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: cfg.color,
            fontSize: "0.6rem",
            lineHeight: 1,
            animation: status === "critical" ? "pulse-dot 1.5s infinite" : undefined,
          }}
        >
          {cfg.icon}
        </span>
        <span style={{ color: "#374151", fontWeight: 600 }}>{label}</span>
        <span style={{ color: cfg.color, fontWeight: 700 }}>{timeStr}</span>
      </div>
    );
  }

  // Full-size version (for mobile cards)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 14px",
        borderRadius: "8px",
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        fontSize: "0.82rem",
        fontWeight: 500,
      }}
    >
      <span
        style={{
          color: cfg.color,
          fontSize: "0.7rem",
          animation: status === "critical" ? "pulse-dot 1.5s infinite" : undefined,
        }}
      >
        {cfg.icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span style={{ color: "#374151", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>
          {cfg.label}
        </span>
      </div>
      <span
        style={{
          marginLeft: "auto",
          color: cfg.color,
          fontWeight: 700,
          fontSize: "0.9rem",
        }}
      >
        {timeStr}
      </span>
    </div>
  );
};

export default DataArrivalIndicator;
