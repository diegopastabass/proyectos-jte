import { useState } from "react";
import logoJte from "../assets/logoJte.png";
import logoBoldos from "../assets/logoboldos.png";

interface NavbarProps {
  text?: string;
  children?: React.ReactNode;
}

function Navbar(props: NavbarProps) {
  const { text, children } = props;

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
    if (timeDiffMinutes <= 10) {
      freshnessClass = "bg-success text-white";
    } else if (timeDiffMinutes <= 20) {
      freshnessClass = "bg-warning text-dark";
    } else {
      freshnessClass = "bg-danger text-white";
    }
  }

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullScreen(true);
        })
        .catch((err) => {
          console.error(
            `Error al intentar activar pantalla completa: ${err.message}`
          );
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullScreen(false);
        })
        .catch((err) => {
          console.error(
            `Error al intentar desactivar pantalla completa: ${err.message}`
          );
        });
    }
  };

  return (
    <nav
      className="navbar navbar-expand-lg navbar-light bg-light rounded shadow-sm mt-2 mx-auto px-3"
      style={{ width: "98%", maxWidth: "100%" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* 1. Logo Principal (Marca) */}
        <a
          className="navbar-brand d-flex align-items-center gap-2 mb-0 me-lg-4"
          href="/boldos/"
        >
          <img src={logoJte} alt="logo" width={50} height={34} />
          <img src={logoBoldos} alt="logo" width={60}/>
        </a>
      </div>{" "}
      <div className="d-flex align-items-center gap-2 flex-grow-1">
        <div className="d-flex flex-column align-items-center text-lg-start">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>
      </div>{" "}
      <div className="d-flex align-items-center gap-2 m-2">
      </div>
      <div className="ms-auto d-none d-md-block m-4 ">{children}</div>
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
    </nav>
  );
}

export default Navbar;
