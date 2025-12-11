// src/components/StatusLed.tsx
import React from "react";

interface StatusLedProps {
  status: number;
  size?: number;
  label?: string; // Texto opcional al lado del led
}

const StatusLed: React.FC<StatusLedProps> = ({ status, size = 16, label }) => {
  const color = status === 0 ? "#28a745" : "#dc3545"; // verde o rojo
  const glow = status === 0 ? "0 0 8px #28a745" : "0 0 8px #dc3545";

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
};

export default StatusLed;
