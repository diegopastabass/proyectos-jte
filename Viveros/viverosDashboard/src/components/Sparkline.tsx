interface SparklineProps {
  puntos: { ms: number; v: number | null }[];
  desde: number;
  hasta: number;
  rangoMin: number | null;
  rangoMax: number | null;
  color: string;
  topeMin: number;
}

/** Mini gráfico de las últimas 24 h, con el rango permitido sombreado y cortes en los huecos. */
function Sparkline({ puntos, desde, hasta, rangoMin, rangoMax, color, topeMin }: SparklineProps) {
  const conValor = puntos.filter((p): p is { ms: number; v: number } => p.v !== null);
  if (conValor.length < 2) return <div className="sparkline sparkline-vacio">sin datos en 24 h</div>;

  const vs = conValor.map((p) => p.v);
  let lo = Math.min(...vs, ...(rangoMin !== null ? [rangoMin] : []));
  let hi = Math.max(...vs, ...(rangoMax !== null ? [rangoMax] : []));
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  lo -= pad;
  hi += pad;
  const W = 100;
  const H = 30;
  const x = (ms: number) => ((ms - desde) / (hasta - desde)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  // Tramos continuos: un hueco mayor que el tope corta la línea.
  const tramos: string[] = [];
  let actual: string[] = [];
  conValor.forEach((p, i) => {
    if (i > 0 && p.ms - conValor[i - 1].ms > topeMin * 60000) {
      tramos.push(actual.join(" "));
      actual = [];
    }
    actual.push(`${x(p.ms).toFixed(2)},${y(p.v).toFixed(2)}`);
  });
  tramos.push(actual.join(" "));

  const yIni = rangoMax !== null ? Math.max(0, y(rangoMax)) : 0;
  const yFin = rangoMin !== null ? Math.min(H, y(rangoMin)) : H;

  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {(rangoMin !== null || rangoMax !== null) && yFin > yIni && (
        <rect x={0} y={yIni} width={W} height={yFin - yIni} fill="rgba(25,135,84,0.12)" />
      )}
      {tramos.map((t, i) =>
        t.includes(" ") ? (
          <polyline key={i} points={t} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ) : null,
      )}
    </svg>
  );
}

export default Sparkline;
