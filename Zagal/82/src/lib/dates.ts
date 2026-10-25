// Fechas como strings YYYY-MM-DD / meses como YYYY-MM, siempre en hora de Chile.
// Comparar strings ISO equivale a comparar fechas, y evita líos de zona horaria.

const chileFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
});

export const todayChile = (): string => chileFormatter.format(new Date());

export const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const monthOf = (date: string): string => date.slice(0, 7);

export const daysInMonth = (month: string): number => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export const monthStart = (month: string): string => `${month}-01`;

export const monthEnd = (month: string): string =>
  `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

export const addMonths = (month: string, delta: number): string => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};

export const toMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

export const minDate = (a: string, b: string) => (a < b ? a : b);
export const maxDate = (a: string, b: string) => (a > b ? a : b);

/** Días entre dos fechas YYYY-MM-DD (b - a) */
export const diffDays = (a: string, b: string): number =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000,
  );

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const monthLabel = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

export const formatDate = (date: string): string => {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
};
