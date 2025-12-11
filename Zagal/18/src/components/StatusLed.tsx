// src/components/StatusLed.tsx
import React from "react";

interface StatusLedProps {
  status: number;
  size?: number;
  label?: string;
}

const StatusLed: React.FC<StatusLedProps> = ({ status, size = 16, label }) => {
  const color = status === 1 ? "#28a745" : "#dc3545"; // verde o rojo
  const glow = status === 1 ? "0 0 8px #28a745" : "0 0 8px #dc3545";

  if (!label) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: glow,
          }}
        />
      </div>
    );
  } else {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: glow,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{label}</span>
      </div>
    );
  }
};

export default StatusLed;
