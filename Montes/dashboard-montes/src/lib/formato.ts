export const formatoNumero = (valor: number, decimales = 1): string =>
  valor.toLocaleString("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

/** Variación porcentual de `actual` respecto de `anterior`; null si no se puede calcular. */
export const variacion = (actual: number, anterior: number): number | null =>
  anterior > 0 ? ((actual - anterior) / anterior) * 100 : null;

export const formatoDuracion = (minutos: number): string => {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};
