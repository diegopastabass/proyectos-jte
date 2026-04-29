import { useState } from "react";

interface Props {
  onNavigate: () => void;
}

export default function Register({ onNavigate }: Props) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.email !== formData.confirmEmail)
      return setError("Los emails no coinciden");
    if (formData.password !== formData.confirmPassword)
      return setError("Las contraseñas no coinciden");

    try {
      const res = await fetch(
        "https://app.jteanalytics.cl/maval/users/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          }),
        },
      );

      if (!res.ok) throw new Error("Error en registro");
      alert("Usuario creado exitosamente");
      onNavigate();
    } catch (err) {
      setError("No se pudo registrar el usuario");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div
        className="card p-4 shadow"
        style={{ maxWidth: "500px", width: "100%" }}
      >
        <h3 className="text-center mb-4">Registro</h3>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label>Nombre Completo</label>
            <input
              className="form-control"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div className="row">
            <div className="col-6 mb-3">
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="col-6 mb-3">
              <label>Confirmar Email</label>
              <input
                type="email"
                className="form-control"
                onChange={(e) =>
                  setFormData({ ...formData, confirmEmail: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="row">
            <div className="col-6 mb-3">
              <label>Contraseña</label>
              <input
                type="password"
                className="form-control"
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
            <div className="col-6 mb-3">
              <label>Confirmar Contraseña</label>
              <input
                type="password"
                className="form-control"
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-success w-100 mb-2">
            Registrarse
          </button>
          <button
            type="button"
            className="btn btn-link w-100"
            onClick={onNavigate}
          >
            Volver al login
          </button>
        </form>
      </div>
    </div>
  );
}
