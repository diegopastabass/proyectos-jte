import { useState } from "react";
import api, { mensajeError } from "../api";
import { Alerta, Modal } from "./comunes";

export default function CambiarPassword({ onCerrar }: { onCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetida) return setError("Las contraseñas nuevas no coinciden");
    setEnviando(true);
    setError("");
    try {
      await api.patch("/auth/password", { actual, nueva });
      setListo(true);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Cambiar contraseña" onCerrar={onCerrar} tamano="sm">
      {listo ? (
        <>
          <div className="alert alert-success">Contraseña actualizada.</div>
          <button className="btn btn-primary w-100" onClick={onCerrar}>
            Cerrar
          </button>
        </>
      ) : (
        <form onSubmit={guardar}>
          <Alerta error={error} />
          <div className="mb-3">
            <label className="form-label">Contraseña actual</label>
            <input type="password" className="form-control" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Nueva (mínimo 10 caracteres)</label>
            <input type="password" className="form-control" value={nueva} minLength={10} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Repetir la nueva</label>
            <input type="password" className="form-control" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={enviando}>
            Guardar
          </button>
        </form>
      )}
    </Modal>
  );
}
