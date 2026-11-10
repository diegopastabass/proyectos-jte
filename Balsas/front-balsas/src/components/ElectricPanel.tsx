import type { PozoId, Snapshot } from "../balsas";

const FILAS = [
  { fase: "L1", vFase: "L1N", linea: "L1-L2", vLinea: "L1L2", corriente: "I1" },
  { fase: "L2", vFase: "L2N", linea: "L2-L3", vLinea: "L2L3", corriente: "I2" },
  { fase: "L3", vFase: "L3N", linea: "L3-L1", vLinea: "L3L1", corriente: "I3" },
] as const;

const promedio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Desviación máxima respecto al promedio, en %. Null si no hay magnitud (bomba detenida). */
const desbalance = (xs: number[]) => {
  const media = promedio(xs);
  if (media <= 0) return null;
  return (Math.max(...xs.map((x) => Math.abs(x - media))) / media) * 100;
};

const formatoDesbalance = (valor: number | null) =>
  valor === null ? "—" : `${valor.toFixed(1)} %`;

interface ElectricPanelProps {
  pozo: PozoId;
  nombre: string;
  snapshot: Snapshot;
}

function ElectricPanel({ pozo, nombre, snapshot }: ElectricPanelProps) {
  const leer = (variable: string) => snapshot[`${pozo}_${variable}`]?.value ?? 0;

  const encendida = snapshot[`${pozo}_bomba`]?.value === 1;
  const automatico = snapshot[`${pozo}_automatico`];
  const corrientes = FILAS.map((f) => leer(f.corriente));
  const voltajesLinea = FILAS.map((f) => leer(f.vLinea));

  return (
    <article className="card balsas-card electric">
      <header className="electric__head">
        <h3 className="electric__title">{nombre}</h3>
        <div className="electric__pills">
          {automatico && (
            <span className="balsas-pill">
              {automatico.value === 1 ? "Automático" : "Manual"}
            </span>
          )}
          <span className={`balsas-pill ${encendida ? "balsas-pill--on" : ""}`}>
            {encendida ? "En marcha" : "Detenida"}
          </span>
        </div>
      </header>

      <div className="electric__resumen">
        <div>
          <span className="balsas-label">Corriente media</span>
          <strong className="electric__valor">
            {promedio(corrientes).toFixed(1)} <small>A</small>
          </strong>
        </div>
        <div>
          <span className="balsas-label">Voltaje de línea medio</span>
          <strong className="electric__valor">
            {promedio(voltajesLinea).toFixed(1)} <small>V</small>
          </strong>
        </div>
      </div>

      <table className="electric__tabla">
        <thead>
          <tr>
            <th scope="col">Fase</th>
            <th scope="col">Corriente</th>
            <th scope="col">Voltaje L-N</th>
            <th scope="col">Línea</th>
            <th scope="col">Voltaje L-L</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.map((f) => (
            <tr key={f.fase}>
              <th scope="row">{f.fase}</th>
              <td>{leer(f.corriente).toFixed(2)} A</td>
              <td>{leer(f.vFase).toFixed(1)} V</td>
              <td className="electric__linea">{f.linea}</td>
              <td>{leer(f.vLinea).toFixed(1)} V</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="electric__pie">
        <span>
          Desbalance corriente: <strong>{formatoDesbalance(encendida ? desbalance(corrientes) : null)}</strong>
        </span>
        <span>
          Desbalance voltaje: <strong>{formatoDesbalance(desbalance(voltajesLinea))}</strong>
        </span>
      </footer>
    </article>
  );
}

export default ElectricPanel;
