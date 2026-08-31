import { useState } from "react";
import { api } from "../api";
import type { User } from "../types";

interface LoginProps {
  onLogin: (user: User) => void;
  onSwitchToRegister: () => void;
}

export default function Login({ onLogin, onSwitchToRegister }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { username, password });

      // Parse token to get user details for state
      const token = response.data.access_token;
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      );

      const payload = JSON.parse(jsonPayload);

      const user: User = {
        id: payload.sub,
        username: payload.username,
        rol: payload.rol,
        isActive: payload.isActive,
        token: token,
      };

      onLogin(user);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(
          err.response.data.message.message || err.response.data.message,
        );
      } else {
        setError("Error de conexión al servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="glass-panel p-5 w-100" style={{ maxWidth: "450px" }}>
        <div className="text-center mb-4">
          <i className="bi bi-car-front text-primary display-3"></i>
          <h2 className="mt-3 fw-bold text-dark">JTE Reconocimiento</h2>
          <p className="text-secondary">Acceso al sistema</p>
        </div>

        {error && (
          <div
            className="alert alert-danger d-flex align-items-center py-2"
            role="alert"
          >
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Usuario</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-person"></i>
              </span>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Ej: username"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Contraseña</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-key"></i>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Tu contraseña"
              />
              <span
                className="input-group-text"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                <i
                  className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                ></i>
              </span>
            </div>
          </div>

          <div className="d-grid gap-2">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>{" "}
                  Ingresando...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2"></i> Iniciar
                  Sesión
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary mt-2"
              onClick={onSwitchToRegister}
              disabled={loading}
            >
              Crear una cuenta nueva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
