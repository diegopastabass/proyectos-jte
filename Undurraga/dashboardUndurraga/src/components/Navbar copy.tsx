import { useState } from "react"; // Necesitas importar useState si aún no está importado

interface NavbarProps {
  text?: string;
  children?: React.ReactNode;
}

function Navbar(props: NavbarProps) {
  const { text, children } = props;

  // Nuevo estado para rastrear si el modo de pantalla completa está activo
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

  // Lógica para alternar el modo de pantalla completa
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      // Entrar a pantalla completa
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
      // Salir de pantalla completa
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

  // Escuchador de eventos para actualizar el estado si el usuario sale de otra forma (e.g., tecla ESC)
  // Aunque en un componente funcional se debe hacer con useEffect, lo simplificaremos aquí:
  // Se recomienda poner este useEffect en el Home.tsx o en un hook dedicado para una mejor gestión.
  /*
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);
  */

  return (
    <nav
      className="navbar navbar-expand-lg navbar-light bg-light rounded shadow-sm mt-2 mx-auto px-3"
      style={{ width: "98%", maxWidth: "100%" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* 1. Logo Principal (Marca) */}
        <a
          className="navbar-brand d-flex align-items-center gap-2 mb-0 me-lg-4"
          href="/zunigamovil/"
        >
          <img
            src="/src/assets/logoJte.png"
            alt="logo"
            width={50}
            height={34}
          />
          <span className="h5 mb-0 d-md-inline">SSR Nerquihe</span>
        </a>

        <div className="d-flex align-items-center gap-2">
          <img
            src="/src/assets/logo_A.png"
            alt="logoProOhiggins"
            width={100}
            className="d-none d-md-block"
          />
          <img
            src="/src/assets/logo_B.png"
            alt="logoSecundarioB"
            width={250}
            className="d-none d-md-block"
          />
          <img
            src="/src/assets/logo_inacap.png"
            alt="logoSecundarioC"
            width={100}
            className="d-none d-md-block"
          />
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 flex-grow-1">
        <div className="d-flex flex-column align-items-center text-lg-start">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>
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
