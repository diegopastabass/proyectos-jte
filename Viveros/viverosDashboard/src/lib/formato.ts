export const formatoNumero = (valor: number | null | undefined, decimales = 1): string =>
  valor === null || valor === undefined || Number.isNaN(valor)
    ? "—"
    : valor.toLocaleString("es-CL", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      });

/** "9,2 °C", "88,9 %", "0,13 kPa". */
export const conUnidad = (
  valor: number | null | undefined,
  unidad: string,
  decimales = 1,
): string => (valor === null || valor === undefined ? "—" : `${formatoNumero(valor, decimales)} ${unidad}`);

export const formatoDuracion = (minutos: number): string => {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  if (h >= 48) return `${Math.floor(h / 24)} d ${h % 24} h`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** "0 a 5 °C", "mín. 80 %", "máx. 23 °C" o "sin rango". */
export const textoRango = (
  min: number | null,
  max: number | null,
  unidad: string,
  decimales = 1,
): string => {
  const n = (v: number) => formatoNumero(v, decimales);
  if (min !== null && max !== null) return `${n(min)} a ${n(max)} ${unidad}`;
  if (min !== null) return `mín. ${n(min)} ${unidad}`;
  if (max !== null) return `máx. ${n(max)} ${unidad}`;
  return "sin rango definido";
};
