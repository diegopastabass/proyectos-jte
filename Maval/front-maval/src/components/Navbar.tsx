import { type User } from "../types";
import logo from "../assets/logoMaval.png";

interface Props {
  user: User;
  onLogout: () => void;
  className?: string;
}

export default function Navbar({ user, onLogout, className }: Props) {
  return (
    <nav
      className={`navbar navbar-expand-lg navbar-dark bg-dark px-3 shadow-sm ${className}`}
    >
      <div className="container-fluid">
        {/* Marca y Logo */}
        <span className="navbar-brand d-flex align-items-center gap-2">
          <img
            src={logo}
            alt="Logo JT"
            style={{ height: "20px", width: "auto" }}
          />
          <span className="h5 mb-0 fw-bold">Cotizaciones</span>
        </span>

        {/* Información de Usuario y Logout */}
        <div className="d-flex align-items-center text-white ms-auto">
          <div className="d-none d-md-flex flex-column align-items-end me-3">
            <span className="fw-bold">{user.name}</span>
            <small
              className="badge bg-secondary text-light"
              style={{ fontSize: "0.7rem" }}
            >
              {user.role === "0" ? "Administrador" : "Técnico"}
            </small>
          </div>

          <button
            onClick={onLogout}
            className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
          >
            <i className="bi bi-box-arrow-right"></i> Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
