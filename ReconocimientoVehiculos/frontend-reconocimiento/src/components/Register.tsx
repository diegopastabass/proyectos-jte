import { useState } from "react";
import { api } from "../api";

interface RegisterProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

export default function Register({ onRegisterSuccess, onSwitchToLogin }: RegisterProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      await api.post("/users/register", { username, password });
      setSuccess(true);
      setTimeout(() => {
        onRegisterSuccess();
      }, 3000);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message.message || err.response.data.message);
      } else {
        setError("Error de conexión al servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container d-flex justify-content-center align-items-center vh-100">
        <div className="glass-panel p-5 text-center" style={{ maxWidth: "450px" }}>
          <i className="bi bi-check-circle-fill text-success display-1 mb-3"></i>
          <h3 className="mt-3 fw-bold text-dark">Registro Exitoso</h3>
          <p className="text-secondary mb-4">
            Tu cuenta ha sido creada. Sin embargo, un administrador debe activarla antes de que puedas iniciar sesión.
          </p>
          <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
          <p className="small text-secondary mt-2">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="glass-panel p-5 w-100" style={{ maxWidth: "450px" }}>
        <div className="text-center mb-4">
          <i className="bi bi-person-plus text-primary display-4"></i>
          <h3 className="mt-3 fw-bold text-dark">Nuevo Registro</h3>
          <p className="text-secondary">Crea una cuenta en el sistema</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center py-2" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Nombre de usuario</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-person"></i></span>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Ej: nuevo_guardia"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Contraseña</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-key"></i></span>
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Tu contraseña (mín 6 char)"
              />
              <span 
                className="input-group-text" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="form-label">Repetir Contraseña</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-key-fill"></i></span>
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirma tu contraseña"
              />
              <span 
                className="input-group-text" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? "Ocultar" : "Mostrar"}
              >
                <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </span>
            </div>
          </div>

          <div className="d-grid gap-2">
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2"></span> Registrando...</>
              ) : (
                <><i className="bi bi-person-plus me-2"></i> Crear Cuenta</>
              )}
            </button>
            <button 
              type="button" 
              className="btn btn-outline-secondary mt-2" 
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Volver al inicio de sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
