/**
 * Fechas en hora de Chile, sin depender de la zona horaria del proceso Node.
 * La columna `viveros_tambo.time` es `timestamp` sin zona y guarda la hora de Chile
 * (la BD está en America/Santiago), así que las consultas comparan contra texto
 * "AAAA-MM-DD HH:MM:SS" en esa misma hora y devuelven `time AT TIME ZONE` (instante).
 */
export const TZ = 'America/Santiago';

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
const fmtOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  timeZoneName: 'longOffset',
});
const fmtFechaHora = new Intl.DateTimeFormat('es-CL', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const fmtFecha = new Intl.DateTimeFormat('es-CL', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Día (AAAA-MM-DD) en Chile del instante dado. */
export const diaChile = (fecha: Date | number = Date.now()): string =>
  fmtDia.format(fecha);

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

/** Desfase de Chile respecto de UTC en minutos (−180 o −240) en el instante dado. */
const desfaseMin = (ms: number): number => {
  const nombre =
    fmtOffset.formatToParts(ms).find((p) => p.type === 'timeZoneName')
      ?.value ?? 'GMT';
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(nombre);
  if (!m) return 0;
  const min = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -min : min;
};

/** Instante de las 00:00 (hora Chile) del día dado. */
export const inicioDiaChile = (dia: string): number => {
  const utc = Date.parse(`${dia}T00:00:00Z`);
  let ms = utc - desfaseMin(utc + 4 * 3600_000) * 60000;
  // Si el desfase cambia justo ese día, se recalcula con el del resultado.
  const corregido = utc - desfaseMin(ms) * 60000;
  if (corregido !== ms) ms = corregido;
  return ms;
};

/** Texto para comparar con la columna `time` (hora Chile sin zona). */
export const textoLocal = (dia: string, hora = '00:00:00'): string =>
  `${dia} ${hora}`;

export const fechaHoraChile = (fecha: Date | number): string =>
  fmtFechaHora.format(fecha).replace(',', '');

export const fechaChile = (fecha: Date | number): string =>
  fmtFecha.format(fecha);

const fmtLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** "AAAA-MM-DD HH:MM:SS" en hora Chile, para comparar o guardar en la columna `time`. */
export const localDeInstante = (fecha: Date | number): string =>
  fmtLocal.format(fecha).replace(', ', ' ');
