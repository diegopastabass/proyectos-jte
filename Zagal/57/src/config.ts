// Configuración propia de esta parcela. Es el ÚNICO archivo que cambia entre
// los dashboards 18, 57 y 82 (junto con assets/zagal.json y vite.config.ts).

export const PARCELA = "57";
export const PARCELA_LABEL = "Parcela 57";
// En desarrollo se puede apuntar a otra API con VITE_API_BASE (ej. una local)
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? `https://app.jteanalytics.cl/zagal/${PARCELA}`;

// El totalizador de /summary e /interval viene en décimas de m³ en esta parcela
export const TOTALIZADOR_FACTOR = 0.1;

// Primer mes con datos que se puede consultar
export const MIN_MONTH = "2025-09";

// Sectores tal como los nombra el backend (mt_name), en orden de despliegue
export const SECTOR_IDS = [
  "NEC 4",
  "RICH LADY",
  "303 NORTE",
  "303 SUR",
  "RP",
  "PARC 54 SUR 1",
  "PARC 54 SUR 2",
  "PARC 54 NORTE",
  "PARC 52",
];
