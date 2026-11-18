import { useState } from "react";
import { Link } from "react-router-dom";
import api, { mensajeError } from "../api";
import { Alerta, Cargando, Encabezado, Modal, Vacio } from "../components/comunes";
import { fecha, pesos } from "../formato";
import { useEmpresa, useSesion } from "../sesion";
import type { Contraparte, Proyecto } from "../types";
import { useCarga } from "../useCarga";

export default function Proyectos() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const [inactivos, setInactivos] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const { datos, error, cargando, recargar } = useCarga<Proyecto[]>(`/empresas/${empresa.id}/proyectos`, {
    incluirInactivos: inactivos ? "true" : "",
  });

  return (
    <div className="container py-4">
      <Encabezado titulo="Proyectos" subtitulo="Centros de costo: lo que entró, lo que salió y el IVA de cada uno.">
        {cargando && <span className="spinner-border spinner-border-sm text-secondary align-self-center" />}
        <div className="form-check form-switch align-self-center me-2">
          <input className="form-check-input" type="checkbox" id="ver-cerrados" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
          <label className="form-check-label small" htmlFor="ver-cerrados">
            Ver cerrados
          </label>
        </div>
        {puede("operador") && (
          <button className="btn btn-primary" onClick={() => setNuevo(true)}>
            <i className="bi bi-plus-lg me-1" /> Nuevo proyecto
          </button>
        )}
      </Encabezado>

      <Alerta error={error} />
      {!datos ? (
        !error && <Cargando />
      ) : datos.length === 0 ? (
        <Vacio icono="bi-briefcase" texto="Todavía no hay proyectos. Cree uno y asígnele movimientos y facturas para ver su balance." />
      ) : (
        <div className="row g-3">
          {datos.map((p) => (
            <div className="col-md-6 col-xl-4" key={p.id}>
              <TarjetaProyecto p={p} />
            </div>
          ))}
        </div>
      )}

      {nuevo && (
        <ProyectoForm
          onCerrar={() => setNuevo(false)}
          onGuardado={() => {
            setNuevo(false);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function TarjetaProyecto({ p }: { p: Proyecto }) {
  const b = p.balance;
  const avance = p.presupuesto ? Math.round((b.gastos.neto / p.presupuesto) * 100) : null;
  return (
    <Link to={`/proyectos/${p.id}`} className="text-reset">
      <div className={`card card-suave shadow-sm h-100 ${p.activo ? "" : "opacity-75"}`}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
            <div>
              <h5 className="mb-0">{p.nombre}</h5>
              <small className="text-muted">
                {p.codigo && <span className="me-2">{p.codigo}</span>}
                {p.fechaInicio && `${fecha(p.fechaInicio)}${p.fechaFin ? ` → ${fecha(p.fechaFin)}` : ""}`}
              </small>
            </div>
            {!p.activo && <span className="badge text-bg-secondary">Cerrado</span>}
          </div>
          <table className="table table-sm mb-2 small">
            <tbody>
              <tr>
                <td className="text-muted ps-0">Ingresos netos</td>
                <td className="monto text-success">{pesos(b.ingresos.neto)}</td>
              </tr>
              <tr>
                <td className="text-muted ps-0">Gastos netos</td>
                <td className="monto text-danger">{pesos(b.gastos.neto)}</td>
              </tr>
              <tr className="fw-semibold">
                <td className="ps-0">Resultado</td>
                <td className={`monto ${b.resultado < 0 ? "text-danger" : ""}`}>{pesos(b.resultado)}</td>
              </tr>
              <tr>
                <td className="text-muted ps-0 border-0">IVA {b.iva.saldo >= 0 ? "a pagar" : "a favor"}</td>
                <td className="monto border-0">{pesos(Math.abs(b.iva.saldo))}</td>
              </tr>
            </tbody>
          </table>
          {avance !== null && (
            <>
              <div className="progress" style={{ height: 6 }}>
                <div className={`progress-bar ${avance > 100 ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.min(100, avance)}%` }} />
              </div>
              <small className="text-muted">
                {avance}% del presupuesto ({pesos(p.presupuesto)})
              </small>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Crear o editar un proyecto. */
export function ProyectoForm({ proyecto, onCerrar, onGuardado }: { proyecto?: Proyecto; onCerrar: () => void; onGuardado: () => void }) {
  const empresa = useEmpresa();
  const contrapartes = useCarga<Contraparte[]>(`/empresas/${empresa.id}/contrapartes`);
  const [nombre, setNombre] = useState(proyecto?.nombre ?? "");
  const [codigo, setCodigo] = useState(proyecto?.codigo ?? "");
  const [descripcion, setDescripcion] = useState(proyecto?.descripcion ?? "");
  const [contraparteId, setContraparteId] = useState<number | "">(proyecto?.contraparteId ?? "");
  const [fechaInicio, setFechaInicio] = useState(proyecto?.fechaInicio ?? "");
  const [fechaFin, setFechaFin] = useState(proyecto?.fechaFin ?? "");
  const [presupuesto, setPresupuesto] = useState(proyecto?.presupuesto?.toString() ?? "");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    // Al editar, vacío = borrar el dato (null); al crear, simplemente no se envía.
    const vacio = proyecto ? null : undefined;
    const cuerpo = {
      nombre: nombre.trim(),
      codigo: codigo.trim() || vacio,
      descripcion: descripcion.trim() || vacio,
      contraparteId: contraparteId === "" ? vacio : contraparteId,
      fechaInicio: fechaInicio || vacio,
      fechaFin: fechaFin || vacio,
      presupuesto: presupuesto === "" ? vacio : Math.round(Number(presupuesto)),
    };
    try {
      if (proyecto) await api.patch(`/empresas/${empresa.id}/proyectos/${proyecto.id}`, cuerpo);
      else await api.post(`/empresas/${empresa.id}/proyectos`, cuerpo);
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={proyecto ? "Editar proyecto" : "Nuevo proyecto"} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Alerta error={error} onCerrar={() => setError("")} />
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label">Nombre</label>
            <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} required autoFocus />
          </div>
          <div className="col-md-4">
            <label className="form-label">Código</label>
            <input className="form-control" placeholder="Opcional" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={40} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Cliente</label>
            <select className="form-select" value={contraparteId} onChange={(e) => setContraparteId(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">— Ninguno —</option>
              {contrapartes.datos
                ?.filter((c) => c.tipo !== "propia")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">Presupuesto de gasto (neto)</label>
            <input type="number" min={0} className="form-control text-end" placeholder="Opcional" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label">Inicio</label>
            <input type="date" className="form-control" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label">Término</label>
            <input type="date" className="form-control" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} />
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <button type="button" className="btn btn-outline-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={enviando}>
            {enviando && <span className="spinner-border spinner-border-sm me-1" />}
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
