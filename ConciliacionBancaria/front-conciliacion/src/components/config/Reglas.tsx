import { useState } from "react";
import api, { mensajeError } from "../../api";
import { pesos } from "../../formato";
import { useEmpresa, useSesion } from "../../sesion";
import type { Categoria, Regla } from "../../types";
import { useCarga } from "../../useCarga";
import { Alerta, Cargando, Modal, Vacio } from "../comunes";

export default function Reglas() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const base = `/empresas/${empresa.id}`;
  const reglas = useCarga<Regla[]>(`${base}/reglas`);
  const categorias = useCarga<Categoria[]>(`${base}/categorias`);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState(false);
  const operador = puede("operador");

  const nombreCategoria = (id: number) => categorias.datos?.find((c) => c.id === id)?.nombre ?? `#${id}`;

  const alternar = async (r: Regla) => {
    try {
      await api.patch(`${base}/reglas/${r.id}`, { activa: !r.activa });
      reglas.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const eliminar = async (r: Regla) => {
    if (!confirm(`¿Eliminar la regla «${r.nombre}»? Las conciliaciones ya hechas no se deshacen.`)) return;
    try {
      await api.delete(`${base}/reglas/${r.id}`);
      reglas.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (!reglas.datos) return reglas.error ? <Alerta error={reglas.error} /> : <Cargando />;

  return (
    <>
      <div className="alert alert-light border small">
        <i className="bi bi-info-circle me-1" />
        Las reglas se aplican antes que todo lo demás y concilian solas. Úselas para movimientos sin documento que se repiten
        (comisiones, recargas, impuestos). Para personas o proveedores, es mejor darles categoría en «Contrapartes».
      </div>
      <Alerta error={error} onCerrar={() => setError("")} />
      {operador && (
        <div className="d-flex justify-content-end mb-3">
          <button className="btn btn-primary" onClick={() => setNueva(true)}>
            <i className="bi bi-plus-lg me-1" />
            Nueva regla
          </button>
        </div>
      )}

      {reglas.datos.length === 0 ? (
        <Vacio icono="bi-signpost-split" texto="Sin reglas todavía." />
      ) : (
        <div className="list-group shadow-sm">
          {reglas.datos.map((r) => (
            <div key={r.id} className={`list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 ${r.activa ? "" : "bg-light text-muted"}`}>
              <div>
                <h6 className="mb-1 fw-bold">
                  {r.nombre}
                  {!r.activa && <span className="badge text-bg-secondary ms-2">Inactiva</span>}
                </h6>
                <small>
                  Si {r.condicion.signo === "abono" ? "es un abono y " : r.condicion.signo === "cargo" ? "es un cargo y " : ""}
                  {r.condicion.glosaContiene && (
                    <>
                      la glosa contiene <code>{r.condicion.glosaContiene}</code>
                    </>
                  )}
                  {r.condicion.montoMin !== undefined && ` · desde ${pesos(r.condicion.montoMin)}`}
                  {r.condicion.montoMax !== undefined && ` · hasta ${pesos(r.condicion.montoMax)}`}
                  {" → "}
                  <strong>{"ignorar" in r.accion ? "Ignorar" : nombreCategoria(r.accion.categoriaId)}</strong>
                </small>
              </div>
              {operador && (
                <div className="btn-group">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => alternar(r)} title={r.activa ? "Desactivar" : "Activar"}>
                    <i className={`bi ${r.activa ? "bi-pause" : "bi-play"}`} />
                  </button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => eliminar(r)} title="Eliminar">
                    <i className="bi bi-trash" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {nueva && (
        <NuevaRegla
          categorias={categorias.datos ?? []}
          onCerrar={() => setNueva(false)}
          onCreada={() => {
            setNueva(false);
            reglas.recargar();
          }}
        />
      )}
    </>
  );
}

function NuevaRegla({ categorias, onCerrar, onCreada }: { categorias: Categoria[]; onCerrar: () => void; onCreada: () => void }) {
  const empresa = useEmpresa();
  const [nombre, setNombre] = useState("");
  const [glosaContiene, setGlosaContiene] = useState("");
  const [signo, setSigno] = useState<"" | "abono" | "cargo">("cargo");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [accion, setAccion] = useState<string>("");
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/empresas/${empresa.id}/reglas`, {
        nombre,
        condicion: {
          glosaContiene: glosaContiene.trim() || undefined,
          signo: signo || undefined,
          montoMin: montoMin ? Number(montoMin) : undefined,
          montoMax: montoMax ? Number(montoMax) : undefined,
        },
        accion: accion === "ignorar" ? { ignorar: true } : { categoriaId: Number(accion) },
      });
      onCreada();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <Modal titulo="Nueva regla" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Alerta error={error} />
        <div className="mb-3">
          <label className="form-label">Nombre</label>
          <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Recargas Movistar" required />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-md-8">
            <label className="form-label">La glosa contiene</label>
            <input className="form-control" value={glosaContiene} onChange={(e) => setGlosaContiene(e.target.value)} placeholder="MOVISTAR" minLength={3} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={signo} onChange={(e) => setSigno(e.target.value as typeof signo)}>
              <option value="cargo">Cargos</option>
              <option value="abono">Abonos</option>
              <option value="">Ambos</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">Monto desde (opcional)</label>
            <input type="number" min={0} className="form-control" value={montoMin} onChange={(e) => setMontoMin(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Monto hasta (opcional)</label>
            <input type="number" min={0} className="form-control" value={montoMax} onChange={(e) => setMontoMax(e.target.value)} />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">Entonces</label>
          <select className="form-select" value={accion} onChange={(e) => setAccion(e.target.value)} required>
            <option value="">— Elegir —</option>
            {categorias
              .filter((c) => c.activa)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Conciliar como «{c.nombre}»
                </option>
              ))}
            <option value="ignorar">Ignorar el movimiento</option>
          </select>
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
