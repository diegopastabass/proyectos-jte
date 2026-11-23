import { useState } from "react";
import { COLOR_ZONA, UNIDAD } from "../config";
import { COLOR_ESTADO } from "../lib/estados";
import { fechaHoraChile } from "../lib/fechas";
import { formatoDuracion, formatoNumero } from "../lib/formato";
import type { Episodio } from "../lib/tipos";

const VISIBLES = 8;

/** Episodios fuera de rango: cuándo empezaron, cuánto duraron y hasta dónde llegaron. */
function Episodios({ episodios }: { episodios: Episodio[] }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? episodios : episodios.slice(0, VISIBLES);

  return (
    <div className="mt-4">
      <h3 className="h6 mb-2">
        Episodios fuera de rango <span className="text-body-secondary fw-normal">({episodios.length})</span>
      </h3>
      {episodios.length === 0 ? (
        <p className="small" style={{ color: COLOR_ESTADO.ok }}>
          <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
          Sin episodios fuera de rango en el período.
        </p>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm align-middle small mb-1">
              <thead>
                <tr>
                  <th>Cámara</th>
                  <th>Variable</th>
                  <th>Inicio</th>
                  <th className="text-end">Duración</th>
                  <th className="text-end">Valor extremo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={`${e.zona}-${e.variable}-${e.inicio}`}>
                    <td>
                      <span className="punto-zona" style={{ background: COLOR_ZONA[e.zona] }} />
                      {e.zonaNombre}
                    </td>
                    <td>
                      {e.variable === "t" ? "Temperatura" : "Humedad"}{" "}
                      <span style={{ color: COLOR_ESTADO.fuera }}>
                        {e.tipo === "bajo" ? "bajo el mínimo" : "sobre el máximo"}
                      </span>
                    </td>
                    <td className="text-nowrap">{fechaHoraChile(e.inicio)}</td>
                    <td className="text-end text-nowrap">
                      {formatoDuracion(e.duracionMin)}
                      {e.enCurso && <span className="badge text-bg-danger ms-1">en curso</span>}
                    </td>
                    <td className="text-end text-nowrap">
                      <strong>
                        {formatoNumero(e.extremo, 1)} {UNIDAD[e.variable]}
                      </strong>
                      {e.limite !== null && (
                        <span className="text-body-secondary">
                          {" "}
                          (límite {formatoNumero(e.limite, 1)})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {episodios.length > VISIBLES && (
            <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setTodos(!todos)}>
              {todos ? "Ver menos" : `Ver los ${episodios.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default Episodios;
