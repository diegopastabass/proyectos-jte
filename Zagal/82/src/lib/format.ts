const nf = (digits: number) =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const nf0 = nf(0);
const nf1 = nf(1);

export const formatNumber = (value: number, digits = 1): string =>
  (digits === 0 ? nf0 : digits === 1 ? nf1 : nf(digits)).format(value);

/** 5400 -> "1 h 30 m" ; 600 -> "10 m" ; 30 -> "30 s" */
export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 1) return "0 m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return `${Math.round(seconds)} s`;
  if (h === 0) return `${m} m`;
  return `${h} h ${String(m).padStart(2, "0")} m`;
};

/** Horas con un decimal: 5400 -> "1,5" */
export const formatHours = (seconds: number): string =>
  formatNumber(seconds / 3600, 1);

/** Variación porcentual con signo: 0.124 -> "+12%" */
export const formatDelta = (ratio: number): string => {
  const pct = Math.round(ratio * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
};

export const relativeDays = (days: number): string => {
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
};
