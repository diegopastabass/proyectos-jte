import { useState } from "react";
import logo from "../assets/montes.jpeg";

interface NavbarProps {
  text?: string;
  children?: React.ReactNode;
}

function Navbar({ text, children }: NavbarProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  let formattedDate = "Desconocida";
  let timeDiffMinutes = null;

  if (text) {
    const timestamp = new Date(text);
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    timeDiffMinutes = Math.floor(diffMs / 60000);
    formattedDate = timestamp.toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  let freshnessClass = "";
  if (timeDiffMinutes !== null) {
    if (timeDiffMinutes <= 10) freshnessClass = "bg-success text-white";
    else if (timeDiffMinutes <= 20) freshnessClass = "bg-warning text-dark";
    else freshnessClass = "bg-danger text-white";
  }

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
      className="navbar navbar-expand-lg navbar-light bg-light rounded shadow-sm mt-2 mx-auto px-3"
      style={{ width: "98%", maxWidth: "100%" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* --- Vista en pantallas grandes --- */}
        <div className="d-none d-md-flex w-100 align-items-center justify-content-between">
          <a
            className="navbar-brand d-flex align-items-center gap-2 mb-0 me-lg-4"
            href="/montes/"
          >
            <img src={logo} alt="logo" width={50} />
            <span className="h5 mb-0 text-secondary">Viña Montes</span>
          </a>

          <div className="d-flex align-items-center gap-2">
            <span className={`badge rounded-pill ${freshnessClass}`}>
              {formattedDate}
            </span>
          </div>

          <div className="ms-auto m-2">{children}</div>

          <button
            className="btn btn-outline-secondary"
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

        {/* --- Vista en dispositivos móviles --- */}
        <div className="d-flex d-md-none w-100 justify-content-between align-items-center">
          <a className="navbar-brand mb-0" href="/undurraga/">
            <img src="/src/assets/lgo.png" alt="logo" width={160} />
          </a>
          <div>{children}</div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
