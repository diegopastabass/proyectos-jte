// Configuración propia de esta parcela. Es el ÚNICO archivo que cambia entre
// los dashboards 18, 57 y 82 (junto con assets/zagal.json y vite.config.ts).

export const PARCELA = "82";
export const PARCELA_LABEL = "Parcela 82";
// En desarrollo se puede apuntar a otra API con VITE_API_BASE (ej. una local)
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? `https://app.jteanalytics.cl/zagal/${PARCELA}`;

// En esta parcela el totalizador de /summary e /interval ya viene en m³
export const TOTALIZADOR_FACTOR = 1;

// Primer mes con datos que se puede consultar
export const MIN_MONTH = "2025-09";

// Sectores tal como los nombra el backend (mt_name), en orden de despliegue.
// No existe SECTOR 7 en esta parcela.
export const SECTOR_IDS = [
  "SECTOR 1",
  "SECTOR 2",
  "SECTOR 3",
  "SECTOR 4",
  "SECTOR 5",
  "SECTOR 6",
  "SECTOR 8",
  "SECTOR 9",
  "SECTOR 10",
  "SECTOR 11",
  "SECTOR 12",
];
