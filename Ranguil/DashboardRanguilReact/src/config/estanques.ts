/* Criterio único de los estanques para el diagrama, las vistas y el panel eléctrico.
   Ambos estanques tienen la misma altura, por lo que comparten capacidad y alarma. */

/** Nivel (m) que corresponde al estanque lleno. */
export const NIVEL_MAX_M = 3.2;

/** Nivel de alarma baja (m). */
export const NIVEL_ALARMA_M = 0.5;

/** Máximo del eje de los gráficos de nivel (m): deja holgura sobre la capacidad. */
export const NIVEL_EJE_GRAFICO_M = 3.5;

/** Volumen (m³) por metro de nivel. */
export const M3_POR_M = 60 / 7;

/** El estanque nuevo llega del PLC en cm; el viejo ya llega en m. */
export const DIVISOR_NIVEL_NUEVO = 100;
