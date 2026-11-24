/**
 * Definición de las zonas del vivero y de sus sensores: el único lugar donde se
 * relacionan los `sensor_id` de `viveros_tambo` con lo que ve el cliente.
 */

export type ZonaId = 'frio' | 'calor' | 'exterior';
export type Variable = 't' | 'hr' | 'vpd';

export const ZONAS_IDS: ZonaId[] = ['frio', 'calor', 'exterior'];
export const VARIABLES: Variable[] = ['t', 'hr', 'vpd'];

export interface ZonaDef {
  id: ZonaId;
  nombre: string;
  /** Las zonas controladas tienen estado y cumplimiento; el exterior solo da contexto. */
  controlada: boolean;
  origen: string;
  sensorT: string;
  sensorHr: string;
  /** Señal 0/1 del equipo de la cámara, si existe. */
  sensorEquipo?: string;
  /**
   * Una lectura vale hasta la siguiente, como máximo estos minutos; más allá es
   * "sin datos". Las cámaras reportan cada 2 min en mediana, pero el 1 % de los
   * intervalos pasa de 14 min (medido en 40 días, nov-2026); el exterior, cada 5 min.
   */
  topeMin: number;
}

export const ZONAS: Record<ZonaId, ZonaDef> = {
  frio: {
    id: 'frio',
    nombre: 'Cámara de Frío',
    controlada: true,
    origen: 'Sensores de la cámara',
    sensorT: '6',
    sensorHr: '4',
    sensorEquipo: '2',
    topeMin: 20,
  },
  calor: {
    id: 'calor',
    nombre: 'Cámara de Calor',
    controlada: true,
    origen: 'Sensores de la cámara',
    sensorT: '5',
    sensorHr: '3',
    sensorEquipo: '1',
    topeMin: 20,
  },
  exterior: {
    id: 'exterior',
    nombre: 'Exterior',
    controlada: false,
    origen: 'Open-Meteo (estimado para la ubicación del vivero)',
    sensorT: '7',
    sensorHr: '8',
    topeMin: 15,
  },
};

export const UNIDADES: Record<Variable, string> = { t: '°C', hr: '%', vpd: 'kPa' };

/**
 * Las temperaturas de las cámaras llegan como entero con signo ×10 leído sin signo:
 * bajo 0 °C aparecen como 6553,x (6553,5 = −0,1 °C; 6553,1 = −0,5 °C). Se ve en la
 * serie de la cámara de frío: 0,2 → 0,1 → 0,0 → 6553,5. Esta expresión SQL lo corrige
 * en todas las consultas (ver PLAN_MEJORAS.md, hallazgo S4).
 */
export const valorSql = (valor = 'value', sensor = 'sensor_id') =>
  `CASE WHEN ${sensor} IN ('5', '6') AND ${valor} > 6000 THEN ${valor} - 6553.6 ELSE ${valor} END`;

/** Valores físicamente posibles; lo que queda fuera se descarta como error del transmisor. */
export const VALIDOS = { t: { min: -40, max: 60 }, hr: { min: 0, max: 100 } };

/** Distancia al límite (dentro del rango) que se marca como "cerca del límite". */
export const MARGENES: Record<Variable, number> = { t: 1, hr: 3, vpd: 0.1 };

/**
 * Frescura del último dato. `sinDatosMin` es el mismo umbral del monitor de
 * desconexión (F3); el retraso es de 15 min (no 10) porque las cámaras tienen
 * huecos de 8 min habituales.
 */
export const FRESCURA = { retrasoMin: 15, sinDatosMin: 30 };

/**
 * Un sensor que repite el mismo valor durante estas horas se marca como "sin variación".
 * La HR de frío repite valores ~5 h con frecuencia (oct-nov 2026), por eso 12 h.
 */
export const HORAS_PEGADO = 12;

export interface Umbral {
  zona: ZonaId;
  variable: Variable;
  min: number | null;
  max: number | null;
  alerta: boolean;
}

/**
 * Umbrales por defecto: los que tenía el `.env` del monitor el 2026-11-18. Se usan
 * mientras no exista la tabla `viveros_umbrales` (ver `sql/001_viveros_umbrales.sql`).
 * El VPD de la cámara de frío queda sin rango hasta que el cliente confirme si aplica.
 */
export const UMBRALES_DEFECTO: Umbral[] = [
  { zona: 'frio', variable: 't', min: 0, max: 5, alerta: true },
  { zona: 'frio', variable: 'hr', min: 80, max: null, alerta: false },
  { zona: 'frio', variable: 'vpd', min: null, max: null, alerta: false },
  { zona: 'calor', variable: 't', min: 22, max: 30, alerta: true },
  { zona: 'calor', variable: 'hr', min: 80, max: null, alerta: false },
  { zona: 'calor', variable: 'vpd', min: 0.8, max: 1.2, alerta: false },
  { zona: 'exterior', variable: 't', min: null, max: 23, alerta: false },
  { zona: 'exterior', variable: 'hr', min: 40, max: null, alerta: false },
  { zona: 'exterior', variable: 'vpd', min: null, max: 2, alerta: true },
];
