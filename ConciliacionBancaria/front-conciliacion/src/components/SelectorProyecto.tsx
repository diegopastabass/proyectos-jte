import { useState } from "react";
import api, { mensajeError } from "../api";
import { useEmpresa, useSesion } from "../sesion";
import type { Proyecto } from "../types";
import { useCarga } from "../useCarga";

/**
 * Proyecto (centro de costo) de un movimiento o documento. Al asignar un movimiento, la API
 * también asigna las facturas con que se concilió.
 */
export default function SelectorProyecto({
  tipo,
  id,
  proyectoId,
  onCambio,
}: {
  tipo: "movimiento" | "documento";
  id: number;
  proyectoId: number | null;
  onCambio: () => void;
}) {
  const empresa = useEmpresa();
  const { puede } = useSesion();
  const proyectos = useCarga<Proyecto[]>(`/empresas/${empresa.id}/proyectos`, { incluirInactivos: "true" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = async (valor: string) => {
    setGuardando(true);
    setError("");
    try {
      await api.post(`/empresas/${empresa.id}/proyectos/asignar`, {
        proyectoId: valor === "" ? null : Number(valor),
        [tipo === "movimiento" ? "movimientoIds" : "documentoIds"]: [id],
      });
      onCambio();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const lista = proyectos.datos ?? [];
  return (
    <div>
      <div className="input-group input-group-sm" style={{ maxWidth: 380 }}>
        <span className="input-group-text">
          <i className="bi bi-briefcase me-1" /> Proyecto
        </span>
        <select
          className="form-select"
          value={proyectoId ?? ""}
          disabled={!puede("operador") || guardando || !proyectos.datos}
          onChange={(e) => cambiar(e.target.value)}
        >
          <option value="">— Sin proyecto —</option>
          {lista
            .filter((p) => p.activo || p.id === proyectoId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo ? `${p.codigo} · ` : ""}
                {p.nombre}
                {!p.activo ? " (cerrado)" : ""}
              </option>
            ))}
        </select>
        {guardando && (
          <span className="input-group-text">
            <span className="spinner-border spinner-border-sm" />
          </span>
        )}
      </div>
      {error && <small className="text-danger">{error}</small>}
      {proyectos.datos && lista.length === 0 && puede("operador") && (
        <small className="text-muted">Cree proyectos en la pestaña Proyectos.</small>
      )}
    </div>
  );
}
