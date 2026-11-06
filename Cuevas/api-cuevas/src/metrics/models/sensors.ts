// Los sensores llegan a la tabla con el prefijo del equipo que los reporta
// (SSR_CUEVAS--slave.caudal, ESTANQUE_20M3--slave.AI12, ...). Hacia afuera se
// exponen siempre sin prefijo.
const PREFIX_REGEX = /^.*?--slave\./;

export const PREFIX_POZO = 'SSR_CUEVAS--slave.';

// Sensores del estanque de 20 m³ que se renombran por un alias legible.
export const SENSOR_ALIASES: Record<string, string> = {
  'ESTANQUE_20M3--slave.AI12': 'nivel_2',
  'ESTANQUE_20M3--slave.AI32': 'voltaje_2',
};

export const SENSOR_NAMES = {
  estanque: `${PREFIX_POZO}estanque`,
  nivel_2: 'ESTANQUE_20M3--slave.AI12',
  voltaje_2: 'ESTANQUE_20M3--slave.AI32',
  caudal: `${PREFIX_POZO}caudal`,
  freatico: `${PREFIX_POZO}freatico`,
  totalizador: `${PREFIX_POZO}totalizador`,
  horometro: `${PREFIX_POZO}horometro`,
  kwh: `${PREFIX_POZO}kwh`,
} as const;

/** Nombre completo en BD de una variable del pozo (L1, I1, ...). */
export const pozoSensor = (variable: string) => `${PREFIX_POZO}${variable}`;

/** Nombre público de un sensor: alias si existe, si no el nombre sin prefijo. */
export const cleanSensorName = (mtName: string): string =>
  SENSOR_ALIASES[mtName] ?? mtName.replace(PREFIX_REGEX, '');
