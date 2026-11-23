/**
 * Todas las fechas se muestran en hora de Chile, sin importar la zona del navegador.
 * Los días se manejan como texto AAAA-MM-DD.
 */
const TZ = "America/Santiago";

const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const fmtHora = new Intl.DateTimeFormat("es-CL", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fmtFechaHora = new Intl.DateTimeFormat("es-CL", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Día (AAAA-MM-DD) en Chile del instante dado. */
export const diaChile = (fecha: Date | string = new Date()): string =>
  fmtDia.format(typeof fecha === "string" ? new Date(fecha) : fecha);

export const hoyChile = (): string => diaChile();

/** Aritmética de días en UTC, así que no la afecta el horario de verano. */
export const sumarDias = (dia: string, n: number): string => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const listarDias = (desde: string, hasta: string): string[] => {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
};

/** "HH:mm" en Chile. */
export const horaChile = (iso: string): string => fmtHora.format(new Date(iso));

/** "dd-mm-aaaa HH:mm" en Chile. */
export const fechaHoraChile = (iso: string): string =>
  fmtFechaHora.format(new Date(iso)).replace(",", "");

/** Minutos desde la medianoche (hora Chile) del instante dado. */
export const minutosDelDia = (iso: string): number => {
  const partes = fmtHora.formatToParts(new Date(iso));
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return valor("hour") * 60 + valor("minute");
};

export const minutosDesde = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

/** "dd-mm" a partir de AAAA-MM-DD. */
export const etiquetaDia = (dia: string): string => {
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
};

/** "jueves 12 de noviembre de 2026" a partir de AAAA-MM-DD. */
export const nombreDia = (dia: string): string =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** "nov 2026" a partir de AAAA-MM. */
export const etiquetaMes = (mes: string): string =>
  new Date(`${mes}-15T12:00:00Z`)
    .toLocaleDateString("es-CL", {
      timeZone: "UTC",
      month: "short",
      year: "numeric",
    })
    .replace(".", "");

/** Últimos `n` meses (AAAA-MM), del más antiguo al actual. */
export const ultimosMeses = (hoy: string, n: number): string[] => {
  const [y, m] = hoy.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
};

/** "hace 5 min", "hace 2 h 10 min", "hace 3 días". */
export const haceCuanto = (iso: string): string => {
  const min = Math.max(0, minutosDesde(iso));
  if (min < 60) return `hace ${min} min`;
  if (min < 48 * 60) {
    const h = Math.floor(min / 60);
    const resto = min % 60;
    return resto ? `hace ${h} h ${resto} min` : `hace ${h} h`;
  }
  return `hace ${Math.floor(min / 1440)} días`;
};

const fmtOffset = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" });

/** Desfase de Chile respecto de UTC en minutos (−180 o −240) en el instante dado. */
const desfaseMin = (ms: number): number => {
  const nombre = fmtOffset.formatToParts(ms).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(nombre);
  if (!m) return 0;
  const min = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -min : min;
};

/** Instante de las 00:00 (hora Chile) del día dado. Igual que en la API. */
export const inicioDiaChile = (dia: string): number => {
  const utc = Date.parse(`${dia}T00:00:00Z`);
  const ms = utc - desfaseMin(utc + 4 * 3600_000) * 60000;
  return utc - desfaseMin(ms) * 60000;
};
