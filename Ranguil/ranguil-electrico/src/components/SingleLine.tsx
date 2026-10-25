import Card from "./Card";

interface SingleLineProps {
  running: boolean;
  falla: boolean;
  vAvg: number;
  iAvg: number;
  kva: number;
  caudal: number;
  presion: number;
  nivel: number; // m
  nivelMax: number; // m
}

function SingleLine({
  running,
  falla,
  vAvg,
  iAvg,
  kva,
  caudal,
  presion,
  nivel,
  nivelMax,
}: SingleLineProps) {
  const elec = running ? "var(--accent)" : "var(--svg-line)";
  const water = running ? "#20c997" : "var(--svg-line)";
  const flowClass = running ? "flow-line" : "";
  const fill = Math.max(0, Math.min(1, nivel / nivelMax));
  const tankTop = 40;
  const tankH = 150;

  return (
    <Card className="panel">
      <div className="d-flex justify-content-between align-items-start">
        <div className="panel-title">
          <i className="bi bi-diagram-3 me-1"></i>Unifilar en vivo
        </div>
        <span
          className={`badge ${falla ? "text-bg-danger" : running ? "text-bg-success" : "text-bg-secondary"}`}
        >
          {falla ? "Falla" : running ? "Bomba en marcha" : "Bomba detenida"}
        </span>
      </div>
      <svg viewBox="0 0 720 250" width="100%" role="img">
        <title>Diagrama unifilar: red, tablero, motor, bomba y estanque</title>

        {/* Red eléctrica */}
        <g stroke={elec} strokeWidth={3} fill="none" strokeLinecap="round">
          <path d="M 45 70 L 45 160 M 25 90 L 65 90 M 30 112 L 60 112 M 35 134 L 55 134" />
          <path d="M 45 70 L 30 55 M 45 70 L 60 55" />
        </g>
        <text x={45} y={185} textAnchor="middle" fontSize={12} fill="currentColor">Red BT</text>

        {/* Líneas de potencia */}
        <line x1={70} y1={125} x2={175} y2={125} stroke={elec} strokeWidth={4} className={flowClass} />
        <line x1={275} y1={125} x2={360} y2={125} stroke={elec} strokeWidth={4} className={flowClass} />
        <line x1={440} y1={125} x2={480} y2={125} stroke="var(--svg-line)" strokeWidth={6} />

        {/* Tablero */}
        <rect x={175} y={75} width={100} height={100} rx={8} fill="var(--svg-fill)" stroke={elec} strokeWidth={3} />
        <text x={225} y={103} textAnchor="middle" fontSize={12} fill="currentColor">Tablero</text>
        <text x={225} y={128} textAnchor="middle" fontSize={20} fontWeight={700} fill="currentColor">
          {vAvg.toFixed(0)} V
        </text>
        <text x={225} y={150} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
          tensión media
        </text>

        {/* Motor */}
        <circle
          cx={400}
          cy={125}
          r={42}
          fill="var(--svg-fill)"
          stroke={falla ? "var(--bad)" : elec}
          strokeWidth={3}
          className={falla ? "pulse" : ""}
        />
        <g className={running ? "rotor" : ""}>
          <path d="M 400 95 L 400 155 M 370 125 L 430 125" stroke={elec} strokeWidth={3} strokeLinecap="round" />
        </g>
        <circle cx={400} cy={125} r={9} fill="var(--svg-fill)" stroke={elec} strokeWidth={3} />
        <text x={400} y={190} textAnchor="middle" fontSize={20} fontWeight={700} fill="currentColor">
          {iAvg.toFixed(1)} A
        </text>
        <text x={400} y={208} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
          {kva.toFixed(1)} kVA
        </text>

        {/* Bomba */}
        <circle cx={520} cy={125} r={38} fill="var(--svg-fill)" stroke={water} strokeWidth={3} />
        <g className={running ? "rotor" : ""}>
          <path
            d="M 520 125 m 0 -26 q 18 8 0 26 q -8 -18 -26 0 q 8 18 26 0 q 18 -8 0 -26"
            fill={water}
            fillOpacity={0.35}
            stroke={water}
            strokeWidth={2}
          />
        </g>
        <text x={520} y={190} textAnchor="middle" fontSize={20} fontWeight={700} fill="currentColor">
          {caudal.toFixed(2)} l/s
        </text>
        <text x={520} y={208} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.7}>
          {presion.toFixed(1)} bar
        </text>

        {/* Impulsión */}
        <line x1={558} y1={125} x2={625} y2={125} stroke={water} strokeWidth={6} className={flowClass} />

        {/* Estanque */}
        <rect x={625} y={tankTop} width={80} height={tankH} rx={6} fill="var(--svg-fill)" stroke="var(--svg-line)" strokeWidth={3} />
        <rect
          x={628}
          y={tankTop + 3 + (tankH - 6) * (1 - fill)}
          width={74}
          height={(tankH - 6) * fill}
          fill="#0dcaf0"
          fillOpacity={0.55}
          style={{ transition: "all 0.8s ease" }}
        />
        <text x={665} y={tankTop - 8} textAnchor="middle" fontSize={12} fill="currentColor">Estanque</text>
        <text x={665} y={215} textAnchor="middle" fontSize={20} fontWeight={700} fill="currentColor">
          {nivel.toFixed(2)} m
        </text>
      </svg>
    </Card>
  );
}

export default SingleLine;
