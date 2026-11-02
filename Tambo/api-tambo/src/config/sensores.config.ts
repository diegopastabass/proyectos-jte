// Nombres de sensor: los que guarda providerTambo.py en ssr_tambo.mt_name
// y los nombres coloquiales con que se sirven por la API.

export const POZOS = ['pozo_1', 'pozo_3'] as const;
export type Pozo = (typeof POZOS)[number];

export const ESTANQUES = [
  'estanque_superior',
  'estanque_intermedio',
  'estanque_inferior',
] as const;
export type Estanque = (typeof ESTANQUES)[number];

/**
 * mt_name en ssr_tambo -> nombre que se sirve.
 */
export const SENSORES: Record<string, Pozo | Estanque> = {
  PLC1_CAUDAL_R: 'pozo_1',
  PLC3_FIT01: 'pozo_3',
  PLC2_LIT001: 'estanque_superior',
  PLC2_LIT002: 'estanque_intermedio',
  PLC2_LIT003: 'estanque_inferior',
};

/**
 * Inverso de SENSORES: nombre que se sirve -> mt_name en ssr_tambo. Un pozo sin
 * sensor no aparece.
 */
export const MT_NAME_DE = Object.fromEntries(
  Object.entries(SENSORES).map(([mtName, nombre]) => [nombre, mtName]),
) as Partial<Record<Pozo | Estanque, string>>;

/**
 * mt_name de los totalizadores por pozo. Aún no llegan: cuando empiecen a
 * hacerlo, reemplazar null por su mt_name. Mientras sea null, /totalizador
 * responde 503.
 */
export const TOTALIZADOR_MT_NAME: Record<Pozo, string | null> = {
  pozo_1: null,
  pozo_3: null,
};
