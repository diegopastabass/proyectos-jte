import React from "react";

interface LevelCircularProps {
  nivelActual: number;
  nivelMaximo: number;
}

export const LevelCircular: React.FC<LevelCircularProps> = ({
  nivelActual,
  nivelMaximo,
}) => {
  const porcentajeReal = Math.max(0, (nivelActual / nivelMaximo) * 100);
  const estaRebasado = porcentajeReal > 100;

  const porcentajeGrafico = Math.min(100, porcentajeReal);

  const radius = 60;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (porcentajeGrafico / 100) * circumference;

  const color = estaRebasado ? "#e53935" : "#2196f3"; // rojo si >100%, azul si normal

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
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference + " " + circumference}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease",
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
          fill={color}
        >
          {porcentajeReal.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
};
