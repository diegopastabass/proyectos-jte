import { fechaHoraChile, haceCuanto } from "../lib/fechas";
import { COLOR_FRESCURA } from "../lib/estados";
import type { Frescura } from "../lib/tipos";

/** Punto de color y "hace X min" según la antigüedad del último dato. */
function EstadoDato({ time, frescura }: { time: string | null; frescura: Frescura }) {
  return (
    <span
      className="small text-body-secondary d-inline-flex align-items-center gap-1 text-nowrap"
      title={time ? `Último dato: ${fechaHoraChile(time)} (hora Chile)` : "Sin datos"}
    >
      <span
        className="d-inline-block rounded-circle"
        style={{ width: 8, height: 8, background: COLOR_FRESCURA[frescura] }}
      />
      {time ? haceCuanto(time) : "sin datos"}
    </span>
  );
}

export default EstadoDato;
