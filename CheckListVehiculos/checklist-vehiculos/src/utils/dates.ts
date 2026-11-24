// Todas las fechas con hora se muestran en hora de Chile, sin importar la zona del dispositivo.
export const TZ = "America/Santiago";

const dateTimeFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
const shortFmt = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "2-digit", month: "2-digit" });

const valid = (d: Date) => !isNaN(d.getTime());

/** "24/11/2026 12:18" */
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  return valid(d) ? dateTimeFmt.format(d).replace(",", "") : String(iso);
};

/** "24/11" */
export const formatShortDate = (iso?: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  return valid(d) ? shortFmt.format(d) : String(iso);
};

/** Para nombres de archivo: "24-11-2026_1218" */
export const formatForFilename = (iso?: string | null): string =>
  formatDateTime(iso).replace(/\//g, "-").replace(" ", "_").replace(":", "");
