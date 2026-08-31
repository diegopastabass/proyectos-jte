import React, { useState } from "react";
import { ViewState } from "../types";
import api from "../api";
import logo from "../assets/logoJte.png";

interface LoginProps {
  setViewState: (view: ViewState) => void;
  onLoginSuccess: (token: string, user: any) => void;
  addToast: (
    msg: string,
    type: "success" | "error" | "warning" | "info",
  ) => void;
}

const Login: React.FC<LoginProps> = ({
  setViewState,
  onLoginSuccess,
  addToast,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Dummy implementation, wait for API
      const response = await api.post("/auth/login", { email, password });
      const user = response.data.user;
      const mappedUser = {
        ...user,
        role: user.is_admin ? "admin" : "operador"
      };
      onLoginSuccess(response.data.access_token || response.data.token, mappedUser);
    } catch (error: any) {
      const msg = error.response?.data?.message || "Error al iniciar sesión";
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100 fade-in">
      <div
        className="glass-card p-4 p-md-5 w-100"
        style={{ maxWidth: "400px" }}
      >
        <div className="text-center mb-4">
          <img src={logo} alt="Logo" width="80" className="mb-3 rounded" />
          <h2 className="text-dark fw-bold">Bienvenido</h2>
          <p className="text-secondary mb-0">Sistema de CheckList Vehicular</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-secondary">
              Correo Electrónico
            </label>
            <div className="input-group">
              <span className="input-group-text bg-tertiary border-secondary text-secondary">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="email"
                className="form-control"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@correo.com"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label text-secondary">Contraseña</label>
            <div className="input-group">
              <span className="input-group-text bg-tertiary border-secondary text-secondary">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type="password"
                className="form-control"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100 py-2 mb-3 fw-medium"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2"></span>
            ) : null}
            Ingresar
          </button>
          <div className="text-center">
            <span className="text-secondary">¿No tienes cuenta? </span>
            <a
              href="#"
              className="text-accent text-decoration-none"
              onClick={(e) => {
                e.preventDefault();
                setViewState("register");
              }}
            >
              Regístrate aquí
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
