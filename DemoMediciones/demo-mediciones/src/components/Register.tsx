import { useState } from "react";
import axios from "axios";

interface Props {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function Register({
  onRegisterSuccess,
  onSwitchToLogin,
}: Props) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        "https://app.jteanalytics.cl/demo-mediciones/users/register",
        form,
      );
      alert("Usuario creado con éxito. Ahora inicia sesión.");
      onRegisterSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h3 className="text-center mb-4">Crear Cuenta</h3>
        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label>Nombre Completo</label>
            <input
              type="text"
              className="form-control"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <label>Contraseña</label>
            <input
              type="password"
              className="form-control"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button
            type="submit"
            className="btn btn-success w-100"
            disabled={loading}
          >
            Registrarse
          </button>
        </form>
        <button className="btn btn-link w-100 mt-2" onClick={onSwitchToLogin}>
          Volver al Login
        </button>
      </div>
    </div>
  );
}
