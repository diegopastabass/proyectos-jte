import { useState } from "react";
import logo from "../assets/lgo.png";
import { claseFrescura } from "../lib/frescura";
import { fechaHoraChile } from "../lib/fechas";

interface NavbarProps {
  /** Hora (ISO) del último dato recibido. */
  text?: string;
  children?: React.ReactNode;
}

function Navbar({ text, children }: NavbarProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const badgeClass = `text-bg-${claseFrescura(text)}`;

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullScreen(true))
        .catch((err) =>
          console.error(`Error al activar pantalla completa: ${err.message}`),
        );
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullScreen(false))
        .catch((err) =>
          console.error(`Error al salir de pantalla completa: ${err.message}`),
        );
    }
  };

  return (
    <nav
      className="navbar bg-body rounded shadow-sm mt-2 mx-auto px-3"
      style={{ width: "98%", maxWidth: "100%" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center gap-2 px-0">
        <a
          className="navbar-brand d-flex align-items-center gap-2 mb-0 me-auto"
          href="/undurraga/"
        >
          <img src={logo} alt="Undurraga" width={160} />
          <span className="h5 mb-0 text-secondary d-none d-lg-inline">
            Dashboard Undurraga - Wine Group
          </span>
        </a>

        <span
          className={`badge rounded-pill ${badgeClass}`}
          title="Último dato recibido"
        >
          <i className="bi bi-clock me-1" />
          {text ? fechaHoraChile(text) : "Sin datos"}
        </span>

        <div className="d-flex align-items-center gap-2">
          {children}
          <button
            className="btn btn-outline-secondary d-none d-md-inline-block"
            onClick={toggleFullScreen}
            title={
              isFullScreen ? "Salir de Pantalla Completa" : "Pantalla Completa"
            }
            aria-label={
              isFullScreen ? "Salir de Pantalla Completa" : "Pantalla Completa"
            }
          >
            {isFullScreen ? (
              <i className="bi bi-fullscreen-exit"></i>
            ) : (
              <i className="bi bi-fullscreen"></i>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
