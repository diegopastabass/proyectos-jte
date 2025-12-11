import BurgerMenu from "./BurgerMenu";
import lgJte from "../assets/logoJte.png";
import lgZ from "../assets/LogoZagal.png";

function Navbar({ text }: { text?: string }) {
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

  const menuItems = [
    { label: "Inicio", href: "https://jteanalytics.cl/zagal/" },
  ];

  return (
    <nav
      className="navbar navbar-expand-lg navbar-light bg-light rounded shadow-sm mt-2 mx-auto px-3"
      style={{ width: "95%", maxWidth: "100%" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2">
        {/* Marca */}
        <a
          className="navbar-brand d-flex align-items-center gap-2 mb-0"
          href="#"
        >
          <img src={lgJte} alt="logo" width={40} height={24} />
          <img src={lgZ} alt="logo" width={60} height={60} />
          <div className="d-flex flex-column align-items-start">
            <span className="h4 mb-0">Agrícola Zagal</span>
            <small className="text-muted">Parcela 57</small>
          </div>
        </a>

        {/* Fecha */}
        <div className="d-flex flex-column align-items-center text-lg-start flex-grow-1 order-0">
          <span className={`badge rounded-pill ${freshnessClass}`}>
            {formattedDate}
          </span>
        </div>

        {/* Burger Menu a la derecha en móvil */}
        <div className="d-lg-none order-1 ms-auto">
          <BurgerMenu items={menuItems} />
        </div>

        {/* BOTONES PARA PANTALLA GRANDE */}
        <div className="d-none d-lg-flex gap-2">
          {menuItems.map((item, i) => (
            <button
              key={i}
              className="btn btn-primary"
              onClick={() => (window.location.href = item.href)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
