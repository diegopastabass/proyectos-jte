interface NavbarProps {
  text?: string;
  children?: React.ReactNode;
}

function Navbar({ text, children }: NavbarProps) {
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

  return (
    <nav
      className="navbar navbar-light bg-light rounded shadow-sm mt-2 mx-auto px-3 py-2 position-relative"
      style={{ width: "95%", maxWidth: "100%" }}
    >
      {/* Aquí se renderiza el children (ej. botón login) en la esquina superior derecha */}
      <div className="position-absolute top-0 end-0 mt-2 me-3">{children}</div>

      <div className="d-flex flex-column flex-lg-row align-items-center justify-content-center text-center text-lg-start gap-2">
        {/* Sección izquierda (logo + texto) */}
        <div className="d-flex flex-column flex-lg-row align-items-center gap-2">
          <img
            src="/src/assets/logo-web.svg"
            alt="logoViveros"
            width={100}
            height={100}
            className="mx-auto mx-lg-0"
          />
          <div className="mt-1 mt-lg-0">
            <h6 className="mb-1 fw-semibold text-secondary">
              Monitoreo Cámaras de Frío - Calor
            </h6>
            {/* En pantallas pequeñas, fecha debajo del texto */}
            <div className="d-lg-none">
              <span className={`badge rounded-pill ${freshnessClass}`}>
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Sección derecha (fecha en pantallas grandes) */}
        <div className="d-none d-lg-flex align-items-center ms-lg-3">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
