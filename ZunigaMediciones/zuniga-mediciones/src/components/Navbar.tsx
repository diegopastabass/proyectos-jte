import { type User } from "../types";
import logoZuniga from "../assets/logoZuniga.png";

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: Props) {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3 shadow-sm">
      <div className="container-fluid">
        {/* Marca y Logo */}
        <span className="navbar-brand d-flex align-items-center gap-2">
          <img
            src={logoZuniga}
            alt="Logo Zuniga"
            style={{ height: "40px", width: "auto" }}
          />
          <span className="h5 mb-0 fw-bold">Zuniga Mediciones</span>
        </span>

        {/* Información de Usuario y Logout */}
        <div className="d-flex align-items-center text-white ms-auto">
          <div className="d-none d-md-flex flex-column align-items-end me-3">
            <span className="fw-bold">{user.fullName}</span>
            <small
              className="badge bg-secondary text-light"
              style={{ fontSize: "0.7rem" }}
            >
              {user.type === "0" ? "Administrador" : "Técnico"}
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
