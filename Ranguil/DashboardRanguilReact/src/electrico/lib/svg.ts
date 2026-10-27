// Helpers para dibujar arcos en SVG (ángulos en radianes, 0 = derecha)
export const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + r * Math.cos(a),
  y: cy - r * Math.sin(a),
});

// Arco entre los ángulos a0 → a1 (a0 > a1: sentido horario sobre la pantalla)
export const arcPath = (
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string => {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
  const sweep = a1 < a0 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
};
