import { useState } from "react";
import api, { mensajeError } from "../../api";
import { BANCOS } from "../../formato";
import { useEmpresa, useSesion } from "../../sesion";
import type { CuentaBancaria } from "../../types";
import { useCarga } from "../../useCarga";
import { Alerta, Cargando, Vacio } from "../comunes";

export default function Cuentas() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const lista = useCarga<CuentaBancaria[]>(`/empresas/${empresa.id}/cuentas`);
  const [editando, setEditando] = useState<number | null>(null);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState("");
  const admin = puede("admin");

  const guardar = async (c: CuentaBancaria, cambio: Partial<CuentaBancaria>) => {
    setError("");
    try {
      await api.patch(`/empresas/${empresa.id}/cuentas/${c.id}`, cambio);
      setEditando(null);
      lista.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (!lista.datos) return lista.error ? <Alerta error={lista.error} /> : <Cargando />;
  if (lista.datos.length === 0) return <Vacio icono="bi-bank" texto="Las cuentas se crean solas al importar la primera cartola de cada una." />;

  return (
    <>
      <Alerta error={error} onCerrar={() => setError("")} />
      <div className="card card-suave shadow-sm">
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Banco</th>
              <th>Número</th>
              <th>Alias</th>
              <th>Estado</th>
              {admin && <th />}
            </tr>
          </thead>
          <tbody>
            {lista.datos.map((c) => (
              <tr key={c.id}>
                <td>{BANCOS[c.banco] ?? c.banco}</td>
                <td>{c.numero}</td>
                <td>
                  {editando === c.id ? (
                    <div className="input-group input-group-sm" style={{ maxWidth: 300 }}>
                      <input className="form-control" value={alias} onChange={(e) => setAlias(e.target.value)} autoFocus />
                      <button className="btn btn-primary" onClick={() => guardar(c, { alias })}>
                        <i className="bi bi-check2" />
                      </button>
                      <button className="btn btn-outline-secondary" onClick={() => setEditando(null)}>
                        <i className="bi bi-x" />
                      </button>
                    </div>
                  ) : (
                    (c.alias ?? <span className="text-muted">—</span>)
                  )}
                </td>
                <td>{c.activa ? <span className="badge text-bg-success">Activa</span> : <span className="badge text-bg-secondary">Inactiva</span>}</td>
                {admin && (
                  <td className="text-end">
                    <div className="btn-group">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        title="Editar alias"
                        onClick={() => {
                          setEditando(c.id);
                          setAlias(c.alias ?? "");
                        }}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" title={c.activa ? "Desactivar" : "Activar"} onClick={() => guardar(c, { activa: !c.activa })}>
                        <i className={`bi ${c.activa ? "bi-toggle-on" : "bi-toggle-off"}`} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
