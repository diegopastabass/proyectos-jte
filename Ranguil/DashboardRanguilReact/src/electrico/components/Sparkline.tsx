interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
}

function Sparkline({
  values,
  color = "var(--accent)",
  height = 34,
}: SparklineProps) {
  if (values.length < 2) return <div style={{ height }} />;

  const w = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, k) => {
    const x = (k / (values.length - 1)) * w;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${w},${height}`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={area} fill={color} opacity={0.15} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r={3} fill={color} />
    </svg>
  );
}

export default Sparkline;
