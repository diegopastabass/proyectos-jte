import { useState } from "react";
import { mensajeError } from "../api";
import logo from "../assets/logo_jt2.png";
import { useSesion } from "../sesion";

export default function Login() {
  const { login } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(mensajeError(err) === "Credenciales inválidas" ? "Credenciales incorrectas" : mensajeError(err));
      setEnviando(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ maxWidth: "400px", width: "100%" }}>
        <img src={logo} alt="Logo" height={50} style={{ margin: "0 auto", width: "auto" }} />
        <h2 className="text-center mt-2 mb-1">Conciliación bancaria</h2>
        <p className="text-center text-muted mb-4">Iniciar sesión</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Contraseña</label>
            <div className="input-group">
              <input
                type={showPass ? "text" : "password"}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button className="btn btn-outline-secondary" type="button" onClick={() => setShowPass(!showPass)}>
                <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`}></i>
              </button>
            </div>
          </div>
          <div className="d-grid gap-2">
            <button type="submit" className="btn btn-primary" disabled={enviando}>
              {enviando ? <span className="spinner-border spinner-border-sm" /> : "Ingresar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
