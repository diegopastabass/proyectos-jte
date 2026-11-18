import type { Linea } from "../config";
import { sumarDias } from "../lib/fechas";
import { formatoNumero, variacion } from "../lib/formato";
import EstadoDato from "./EstadoDato";
import type { Punto } from "./types";

interface MetricCardProps {
  linea: Linea;
  caudal?: Punto;
  totalizador?: Punto;
  /** Consumo diario de los últimos 15 días (incluido hoy). */
  diario: Punto[];
  hoy: string;
}

const sumaDias = (porDia: Map<string, number>, hoy: string, desde: number, hasta: number) => {
  let total = 0;
  for (let i = desde; i <= hasta; i++) total += porDia.get(sumarDias(hoy, -i)) ?? 0;
  return total;
};

/**
 * Resumen de una línea: caudal actual y consumo de hoy, ayer y los últimos 7 días.
 * Sin sensor de caudal (piscina), el dato principal es el consumo de hoy.
 */
function MetricCard({ linea, caudal, totalizador, diario, hoy }: MetricCardProps) {
  const sinCaudal = !linea.caudal;
  const columna = sinCaudal ? "col-6" : "col-4";
  const porDia = new Map(diario.map((d) => [d.time, d.value]));
  const consumoHoy = porDia.get(hoy);
  const consumoAyer = porDia.get(sumarDias(hoy, -1));
  // Días completos: ayer y los 6 anteriores, contra los 7 previos.
  const semana = sumaDias(porDia, hoy, 1, 7);
  const semanaAnterior = sumaDias(porDia, hoy, 8, 14);
  const delta = variacion(semana, semanaAnterior);

  return (
    <div className="card h-100 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h6 mb-0 text-body-secondary">
            <span
              className="d-inline-block rounded-circle me-2"
              style={{ width: 10, height: 10, background: linea.color }}
            />
            {linea.nombre}
          </h2>
          <EstadoDato time={(caudal ?? totalizador)?.time} />
        </div>

        <div className="d-flex align-items-baseline gap-1">
          <span className="display-6 fw-bold">
            {sinCaudal
              ? consumoHoy === undefined
                ? "—"
                : formatoNumero(consumoHoy, 0)
              : caudal
                ? formatoNumero(caudal.value, 1)
                : "—"}
          </span>
          <span className="text-body-secondary">{sinCaudal ? "m³" : "m³/h"}</span>
        </div>
        <div className="small text-body-secondary mb-3">
          {sinCaudal ? "Consumo hoy" : "Caudal actual"}
        </div>

        <div className="row g-2 text-center">
          {!sinCaudal && <Stat etiqueta="Hoy" valor={consumoHoy} columna={columna} />}
          <Stat etiqueta="Ayer" valor={consumoAyer} columna={columna} />
          <div className={columna}>
            <div className="border rounded py-1 h-100" title="Ayer y los 6 días anteriores, comparado con los 7 días previos">
              <div className="small text-body-secondary">7 días</div>
              <div className="fw-semibold">{formatoNumero(semana, 0)} m³</div>
              {delta !== null && (
                <div className="text-body-tertiary" style={{ fontSize: "0.75rem" }}>
                  {delta >= 0 ? "▲" : "▼"} {formatoNumero(Math.abs(delta), 0)}% vs. anterior
                </div>
              )}
            </div>
          </div>
        </div>

        {totalizador && (
          <div className="small text-body-tertiary mt-2">
            Totalizador: {formatoNumero(totalizador.value, 0)} m³
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  etiqueta,
  valor,
  columna,
}: {
  etiqueta: string;
  valor?: number;
  columna: string;
}) {
  return (
    <div className={columna}>
      <div className="border rounded py-1 h-100">
        <div className="small text-body-secondary">{etiqueta}</div>
        <div className="fw-semibold">
          {valor === undefined ? "—" : `${formatoNumero(valor, 0)} m³`}
        </div>
      </div>
    </div>
  );
}

export default MetricCard;
