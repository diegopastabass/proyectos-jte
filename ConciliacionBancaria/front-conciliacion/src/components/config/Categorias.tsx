import { useState } from "react";
import api, { mensajeError } from "../../api";
import { useEmpresa, useSesion } from "../../sesion";
import type { Categoria } from "../../types";
import { useCarga } from "../../useCarga";
import { Alerta, Cargando } from "../comunes";

const TIPOS: Record<Categoria["tipo"], string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  traspaso: "Traspaso",
  retiro: "Retiro",
  impuesto: "Impuesto",
  otro: "Otro",
};

export default function Categorias() {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const lista = useCarga<Categoria[]>(`/empresas/${empresa.id}/categorias`);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Categoria["tipo"]>("gasto");
  const [error, setError] = useState("");

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/empresas/${empresa.id}/categorias`, { nombre, tipo });
      setNombre("");
      lista.recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  if (!lista.datos) return lista.error ? <Alerta error={lista.error} /> : <Cargando />;

  return (
    <>
      <Alerta error={error} onCerrar={() => setError("")} />
      {puede("admin") && (
        <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={crear}>
          <input className="form-control" style={{ maxWidth: 320 }} placeholder="Nueva categoría" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <select className="form-select" style={{ maxWidth: 180 }} value={tipo} onChange={(e) => setTipo(e.target.value as Categoria["tipo"])}>
            {Object.entries(TIPOS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">
            <i className="bi bi-plus-lg me-1" />
            Agregar
          </button>
        </form>
      )}
      <div className="card card-suave shadow-sm">
        <ul className="list-group list-group-flush">
          {lista.datos.map((c) => (
            <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <i className="bi bi-tag me-2 text-muted" />
                {c.nombre}
              </span>
              <span className="badge bg-light text-secondary border">{TIPOS[c.tipo]}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
