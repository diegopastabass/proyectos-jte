import React, { useState } from "react";
import { ViewState } from "../types";
import api from "../api";

interface RegisterProps {
  setViewState: (view: ViewState) => void;
  addToast: (
    msg: string,
    type: "success" | "error" | "warning" | "info",
  ) => void;
}

const Register: React.FC<RegisterProps> = ({ setViewState, addToast }) => {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/register", { name: nombre, email, password });
      setSuccess(true);
      addToast("Registro exitoso", "success");
    } catch (error: any) {
      addToast(error.response?.data?.message || "Error al registrar", "error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container d-flex justify-content-center align-items-center min-vh-100 fade-in">
        <div
          className="glass-card p-4 p-md-5 w-100 text-center"
          style={{ maxWidth: "400px" }}
        >
          <i
            className="bi bi-check-circle-fill text-success mb-3"
            style={{ fontSize: "4rem" }}
          ></i>
          <h3 className="text-dark">Registro Exitoso</h3>
          <p className="text-secondary mt-3">
            Tu cuenta ha sido creada, pero requiere activación por parte de un
            administrador para poder ingresar.
          </p>
          <button
            className="btn btn-outline-light mt-4 w-100"
            onClick={() => setViewState("login")}
          >
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100 fade-in">
      <div
        className="glass-card p-4 p-md-5 w-100"
        style={{ maxWidth: "400px" }}
      >
        <div className="text-center mb-4">
          <h2 className="text-dark fw-bold">Crear Cuenta</h2>
          <p className="text-secondary mb-0">Regístrate como operador</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-secondary">Nombre Completo</label>
            <input
              type="text"
              className="form-control"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-secondary">
              Correo Electrónico
            </label>
            <input
              type="email"
              className="form-control"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
            />
          </div>
          <div className="mb-4">
            <label className="form-label text-secondary">Contraseña</label>
            <input
              type="password"
              className="form-control"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100 py-2 mb-3 fw-medium"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2"></span>
            ) : null}
            Registrarse
          </button>
          <div className="text-center">
            <a
              href="#"
              className="text-secondary text-decoration-none"
              onClick={(e) => {
                e.preventDefault();
                setViewState("login");
              }}
            >
              Volver al Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
