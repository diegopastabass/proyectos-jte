import { useState } from "react";

interface LoginModalProps {
  show: boolean;
  onClose: () => void;
  onLoginSuccess: (userRole: string, accessToken: string) => void;
}

export default function LoginModal({
  show,
  onClose,
  onLoginSuccess,
}: LoginModalProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const validatePassword = (pwd: string): boolean => {
    const regex = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=<>?{}[\]~]).{8,}$/;
    return regex.test(pwd);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(
        "https://app.jteanalytics.cl/viveros/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) throw new Error("Credenciales inválidas");

      const data = await res.json();
      onLoginSuccess(data.user_role, data.access_token);
      onClose();
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setMessage("Error al iniciar sesión. Verifica tus credenciales.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!validatePassword(password)) {
      setMessage(
        "La contraseña debe tener al menos 8 caracteres, un número y un símbolo."
      );
      setIsError(true);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      setIsError(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        "https://app.jteanalytics.cl/viveros/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        }
      );

      if (res.status === 201) {
        setMessage("Registro exitoso. Ahora puedes iniciar sesión.");
        setIsError(false);
        setIsRegisterMode(false);
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        /* ignoramos si no hay body */
      }

      if (!res.ok) {
        throw new Error(data?.message || "Error al registrar usuario");
      }
    } catch (error: unknown) {
      console.error("Error al registrar usuario:", error);
      if (error instanceof Error) {
        setMessage(error.message || "Ocurrió un error durante el registro.");
      } else {
        setMessage("Ocurrió un error durante el registro.");
      }
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal d-block"
      tabIndex={-1}
      role="dialog"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {isRegisterMode ? "Registro" : "Login"}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {message && (
              <div
                className={`alert ${
                  isError ? "alert-danger" : "alert-success"
                }`}
              >
                {message}
              </div>
            )}
            <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
              {isRegisterMode && (
                <div className="mb-3">
                  <label className="form-label">Nombre de usuario</label>
                  <input
                    type="text"
                    className="form-control"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3 position-relative">
                <label className="form-label">Contraseña</label>
                <div className="input-group">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <i className="bi bi-eye"></i>
                    ) : (
                      <i className="bi bi-eye-slash"></i>
                    )}
                  </button>
                </div>
                {isRegisterMode && (
                  <small className="form-text text-muted">
                    Debe tener al menos 8 caracteres, un número y un símbolo.
                  </small>
                )}
              </div>

              {isRegisterMode && (
                <div className="mb-3">
                  <label className="form-label">Confirmar contraseña</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading
                  ? isRegisterMode
                    ? "Registrando..."
                    : "Ingresando..."
                  : isRegisterMode
                  ? "Registrarse"
                  : "Ingresar"}
              </button>
            </form>

            <div className="text-center mt-3">
              {isRegisterMode ? (
                <small>
                  ¿Ya tienes cuenta?{" "}
                  <button
                    className="btn btn-link p-0"
                    type="button"
                    onClick={() => setIsRegisterMode(false)}
                  >
                    Inicia sesión aquí
                  </button>
                </small>
              ) : (
                <small>
                  ¿Aún no estás registrado?{" "}
                  <button
                    className="btn btn-link p-0"
                    type="button"
                    onClick={() => setIsRegisterMode(true)}
                  >
                    Regístrate aquí
                  </button>
                </small>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
