import { fechaHoraChile, haceCuanto } from "../lib/fechas";
import { claseFrescura } from "../lib/frescura";

function EstadoDato({ time }: { time?: string }) {
  const clase = claseFrescura(time);
  return (
    <span
      className="small text-body-secondary d-inline-flex align-items-center gap-1"
      title={time ? `Último dato: ${fechaHoraChile(time)}` : "Sin datos"}
    >
      <span
        className={`d-inline-block rounded-circle bg-${clase}`}
        style={{ width: 8, height: 8 }}
      />
      {time ? haceCuanto(time) : "sin datos"}
    </span>
  );
}

export default EstadoDato;
