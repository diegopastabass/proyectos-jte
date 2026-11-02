import { useState } from "react";
import api, { mensajeError } from "../../api";
import { ROLES } from "../../formato";
import { useEmpresa, useSesion } from "../../sesion";
import type { Rol, UsuarioAdmin, UsuarioEmpresa } from "../../types";
import { useCarga } from "../../useCarga";
import { Alerta, Cargando, Modal } from "../comunes";

/** Acceso a esta empresa (admin de la empresa) y, para el administrador general, alta de usuarios. */
export default function Usuarios() {
  const empresa = useEmpresa();
  const { usuario } = useSesion();
  const base = `/empresas/${empresa.id}`;
  const conAcceso = useCarga<UsuarioEmpresa[]>(`${base}/usuarios`);
  // El listado general de usuarios solo lo puede ver el administrador general.
  const todos = useCarga<UsuarioAdmin[]>(usuario?.esAdmin ? "/usuarios" : null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [asignarId, setAsignarId] = useState<number | "">("");
  const [asignarRol, setAsignarRol] = useState<Rol>("operador");
  const [restablecer, setRestablecer] = useState<UsuarioEmpresa | null>(null);

  const recargar = () => {
    conAcceso.recargar();
    todos.recargar();
  };

  const asignar = async (usuarioId: number, rol: Rol) => {
    setError("");
    try {
      await api.put(`${base}/usuarios`, { usuarioId, rol });
      setAsignarId("");
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  const quitar = async (u: UsuarioEmpresa) => {
    if (!confirm(`¿Quitar el acceso de ${u.nombre} a ${empresa.razonSocial}?`)) return;
    try {
      await api.delete(`${base}/usuarios/${u.id}`);
      recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (!conAcceso.datos) return conAcceso.error ? <Alerta error={conAcceso.error} /> : <Cargando />;
  const sinAcceso = (todos.datos ?? []).filter((u) => u.activo && !conAcceso.datos!.some((a) => a.id === u.id));

  return (
    <>
      <Alerta error={error} onCerrar={() => setError("")} />
      <div className="alert alert-light border small">
        <strong>Lector</strong>: solo consulta. <strong>Operador</strong>: importa, concilia y revisa la bandeja.{" "}
        <strong>Administrador</strong>: además cambia cuentas, categorías, contrapartes y usuarios.
      </div>

      <div className="card card-suave shadow-sm mb-3">
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Usuario</th>
              <th style={{ width: 200 }}>Rol en {empresa.razonSocial}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {conAcceso.datos.map((u) => (
              <tr key={u.id} className={u.activo ? "" : "text-muted"}>
                <td>
                  <div className="fw-semibold">
                    {u.nombre}
                    {!u.activo && <span className="badge text-bg-secondary ms-2">Desactivado</span>}
                  </div>
                  <small className="text-muted">{u.email}</small>
                </td>
                <td>
                  <select className="form-select form-select-sm" value={u.rol} disabled={u.id === usuario?.id} onChange={(e) => asignar(u.id, e.target.value as Rol)}>
                    {Object.entries(ROLES).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-end">
                  {u.id !== usuario?.id && (
                    <div className="btn-group">
                      {usuario?.esAdmin && (
                        <button className="btn btn-outline-secondary btn-sm" title="Restablecer contraseña" onClick={() => setRestablecer(u)}>
                          <i className="bi bi-key" />
                        </button>
                      )}
                      <button className="btn btn-outline-danger btn-sm" title="Quitar acceso" onClick={() => quitar(u)}>
                        <i className="bi bi-person-dash" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {usuario?.esAdmin && (
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <select className="form-select" style={{ maxWidth: 300 }} value={asignarId} onChange={(e) => setAsignarId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Dar acceso a un usuario existente…</option>
            {sinAcceso.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.email})
              </option>
            ))}
          </select>
          <select className="form-select" style={{ maxWidth: 160 }} value={asignarRol} onChange={(e) => setAsignarRol(e.target.value as Rol)}>
            {Object.entries(ROLES).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <button className="btn btn-outline-primary" disabled={asignarId === ""} onClick={() => asignarId !== "" && asignar(asignarId, asignarRol)}>
            Dar acceso
          </button>
          <button className="btn btn-primary ms-auto" onClick={() => setNuevo(true)}>
            <i className="bi bi-person-plus me-1" />
            Nuevo usuario
          </button>
        </div>
      )}

      {nuevo && (
        <NuevoUsuario
          onCerrar={() => setNuevo(false)}
          onCreado={async (id, rol) => {
            setNuevo(false);
            await asignar(id, rol);
          }}
        />
      )}
      {restablecer && <Restablecer usuario={restablecer} onCerrar={() => setRestablecer(null)} />}
    </>
  );
}

function NuevoUsuario({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (id: number, rol: Rol) => void }) {
  const empresa = useEmpresa();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("operador");
  const [error, setError] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<UsuarioAdmin>("/usuarios", { nombre, email, password });
      onCreado(r.data.id, rol);
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <Modal titulo="Nuevo usuario" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Alerta error={error} />
        <div className="mb-3">
          <label className="form-label">Nombre</label>
          <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Contraseña inicial (mínimo 10 caracteres)</label>
          <input type="password" className="form-control" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <small className="text-muted">Entréguela por un canal seguro; el usuario puede cambiarla desde su menú.</small>
        </div>
        <div className="mb-3">
          <label className="form-label">Rol en {empresa.razonSocial}</label>
          <select className="form-select" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {Object.entries(ROLES).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary">Crear</button>
        </div>
      </form>
    </Modal>
  );
}

function Restablecer({ usuario, onCerrar }: { usuario: UsuarioEmpresa; onCerrar: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/usuarios/${usuario.id}`, { password });
      setListo(true);
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <Modal titulo={`Restablecer contraseña de ${usuario.nombre}`} onCerrar={onCerrar} tamano="sm">
      {listo ? (
        <>
          <div className="alert alert-success">Contraseña restablecida.</div>
          <button className="btn btn-primary w-100" onClick={onCerrar}>
            Cerrar
          </button>
        </>
      ) : (
        <form onSubmit={guardar}>
          <Alerta error={error} />
          <input type="password" className="form-control mb-3" placeholder="Nueva contraseña (mín. 10)" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <button className="btn btn-primary w-100">Guardar</button>
        </form>
      )}
    </Modal>
  );
}
