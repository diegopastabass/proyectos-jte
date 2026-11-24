const BASE = (import.meta.env.VITE_API_URL || "https://app.jteanalytics.cl/checklist-vehiculos/").replace(/\/+$/, "");

/** URL pública de una foto guardada en el servidor */
export const photoUrl = (imagePath: string): string => `${BASE}/uploads/${imagePath}`;
