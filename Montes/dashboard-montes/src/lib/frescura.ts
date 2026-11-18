import { MIN_SIN_DATOS, MIN_VERDE } from "../config";
import { minutosDesde } from "./fechas";

/** Clase de color de Bootstrap según la antigüedad del último dato. */
export const claseFrescura = (iso?: string): string => {
  if (!iso) return "secondary";
  const min = minutosDesde(iso);
  if (min <= MIN_VERDE) return "success";
  if (min <= MIN_SIN_DATOS) return "warning";
  return "danger";
};
