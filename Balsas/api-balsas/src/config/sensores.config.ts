// Sensores de ssr_balsas. Cada lectura llega con el prefijo del equipo que la
// reporta (UNO_BALSAS--slave.I1, ESTANQUE_BALSAS--slave.estanque, ...) y aquí se
// define el nombre público y la división que la deja en unidades de ingeniería:
// la API siempre entrega m, l/s, bar, V, A y m³.

export const POZOS = ['pozo_1', 'pozo_2'] as const;
export type Pozo = (typeof POZOS)[number];

export const EQUIPOS = [
  { id: 'pozo_1', nombre: 'Pozo 1', equipo: 'UNO_BALSAS' },
  { id: 'pozo_2', nombre: 'Pozo 2', equipo: 'DOS_BALSAS' },
  { id: 'estanque', nombre: 'Estanque', equipo: 'ESTANQUE_BALSAS' },
] as const;

export interface Sensor {
  mtName: string;
  divisor: number;
}

const FASES = ['L1N', 'L2N', 'L3N'] as const;
const LINEAS = ['L1L2', 'L2L3', 'L3L1'] as const;
const CORRIENTES = ['I1', 'I2', 'I3'] as const;

export const VARIABLES_VOLTAJE = { fase: FASES, linea: LINEAS } as const;
export const VARIABLES_CORRIENTE = CORRIENTES;

const prefijoPozo = (pozo: Pozo) =>
  `${EQUIPOS.find((e) => e.id === pozo)!.equipo}--slave.`;

/** Nombre público de una variable eléctrica de un pozo (pozo_1_L1N, pozo_2_I3, ...). */
export const variablePozo = (pozo: Pozo, variable: string) =>
  `${pozo}_${variable}`;

// Voltajes y corrientes llegan ×100 (41452 = 414,52 V; 1952 = 19,52 A).
const electricas = Object.fromEntries(
  POZOS.flatMap((pozo) =>
    [...FASES, ...LINEAS, ...CORRIENTES].map((variable) => [
      variablePozo(pozo, variable),
      { mtName: `${prefijoPozo(pozo)}${variable}`, divisor: 100 },
    ]),
  ),
) as Record<string, Sensor>;

export const SENSORES: Record<string, Sensor> = {
  ...electricas,

  // Pozo 1: el caudalímetro aún no reporta. Hasta que llegue no aparece en el
  // snapshot. Escala supuesta igual a la del Pozo 2 (×10): confirmar con el primer dato.
  pozo_1_caudal: { mtName: 'UNO_BALSAS--slave.caudal', divisor: 10 },

  // Pozo 2: tablero con PLC. El caudal llega ×10 (133 = 13,3 l/s), la presión ×10
  // (67 = 6,7 bar) y el totalizador en décimas de m³.
  pozo_2_bomba: { mtName: 'DOS_BALSAS--slave.bomba', divisor: 1 },
  pozo_2_automatico: { mtName: 'DOS_BALSAS--slave.automatico', divisor: 1 },
  pozo_2_manual: { mtName: 'DOS_BALSAS--slave.manual', divisor: 1 },
  caudal: { mtName: 'DOS_BALSAS--slave.caudal', divisor: 10 },
  presion: { mtName: 'DOS_BALSAS--slave.presion', divisor: 10 },
  totalizador: { mtName: 'DOS_BALSAS--slave.totalizador', divisor: 10 },

  // Estanque: nivel en cm, solar en mV, descarga con las mismas escalas del pozo.
  estanque: { mtName: 'ESTANQUE_BALSAS--slave.estanque', divisor: 100 },
  solar: { mtName: 'ESTANQUE_BALSAS--slave.solar_estanque', divisor: 1000 },
  caudal_descarga: {
    mtName: 'ESTANQUE_BALSAS--slave.caudal_estanque',
    divisor: 10,
  },
  totalizador_descarga: {
    mtName: 'ESTANQUE_BALSAS--slave.totalizador_descarga',
    divisor: 10,
  },
};

/** Inverso de SENSORES: mt_name en la tabla -> nombre público. */
export const NOMBRE_DE = Object.fromEntries(
  Object.entries(SENSORES).map(([nombre, s]) => [s.mtName, nombre]),
) as Record<string, string>;

/**
 * Corriente (A) sobre la que se considera que la bomba está en marcha. UNO_BALSAS
 * no reporta señal de bomba, así que su estado y los horómetros de ambos pozos se
 * deducen de la corriente de la fase L1.
 */
export const UMBRAL_CORRIENTE_A = 1;
