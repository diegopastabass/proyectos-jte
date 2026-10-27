const TZ = "America/Santiago";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

export const santiagoDay = (t: number | Date): string => dayFmt.format(t);

export const santiagoHour = (t: number): number =>
  Number(hourFmt.format(t).slice(0, 2));

export const utcDay = (t: number): string =>
  new Date(t).toISOString().split("T")[0];

// Resta n días a una fecha YYYY-MM-DD
export const shiftDay = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
};

export const formatDayShort = (day: string): string => {
  const [, m, d] = day.split("-");
  return `${d}-${m}`;
};

export const minutesToHHMM = (mins: number): string => {
  const rounded = Math.round(mins);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
