interface NavbarProps {
  text?: string;
  children?: React.ReactNode;
}

function Navbar(props: NavbarProps) {
  const { text, children } = props;

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
      className="navbar navbar-expand-lg navbar-light bg-light rounded shadow-sm mt-2 mx-auto px-3"
      style={{ width: "98%", maxWidth: "100%" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2">
        <a
          className="navbar-brand d-flex align-items-center gap-2 mb-0"
          href="/zunigamovil/"
        >
          <img
            src="/src/assets/logoJte.png"
            alt="logo"
            width={50}
            height={34}
          />
          <span className="h5 mb-0">Analytics</span>
        </a>
        {/* Fecha y estado */}
        <div className="d-flex flex-column align-items-center text-lg-start flex-grow-1 order-2 order-lg-0">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>
        <div className="position-absolute top-0 end-0 mt-2 me-3">
          {children}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
