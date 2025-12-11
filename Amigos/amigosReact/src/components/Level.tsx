import React from "react";

interface TankLevelCircularProps {
  nivelActual: number;
  nivelMaximo: number;
}

export const TankLevelCircular: React.FC<TankLevelCircularProps> = ({
  nivelActual,
  nivelMaximo,
}) => {
  const porcentaje = (nivelActual / nivelMaximo) * 100;

  const radius = 60;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (porcentaje / 100) * circumference;

  return (
    <div style={{ textAlign: "center" }}>
      <svg height={radius * 2} width={radius * 2}>
        <circle
          stroke="#e0e0e0"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#2196f3" // Azul
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + " " + circumference}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 0.5s ease",
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
          }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="20px"
          fontWeight="bold"
          fill="#2196f3"
        >
          {porcentaje.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
};
