import BurgerMenu from "./BurgerMenu";
import lgoJte from "../assets/logoJte.png";
import lgoZ from "../assets/LogoZagal.png";
import { PARCELA_LABEL } from "../config";

interface NavbarProps {
  /** Timestamp de la última medición recibida */
  lastUpdate?: string | null;
  refreshing?: boolean;
}

function Navbar({ lastUpdate, refreshing }: NavbarProps) {
  let formattedDate = "Desconocida";
  let timeDiffMinutes: number | null = null;

  if (lastUpdate) {
    const timestamp = new Date(lastUpdate);
    timeDiffMinutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
    formattedDate = timestamp.toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  let freshnessClass = "bg-secondary text-white";
  let freshnessText = "Sin datos";
  if (timeDiffMinutes !== null) {
    if (timeDiffMinutes <= 10) {
      freshnessClass = "bg-success text-white";
      freshnessText = "Datos al día";
    } else if (timeDiffMinutes <= 20) {
      freshnessClass = "bg-warning text-dark";
      freshnessText = `Sin datos hace ${timeDiffMinutes} min`;
    } else {
      freshnessClass = "bg-danger text-white";
      freshnessText =
        timeDiffMinutes < 120
          ? `Sin datos hace ${timeDiffMinutes} min`
          : `Sin datos hace ${Math.floor(timeDiffMinutes / 60)} h`;
    }
  }

  const menuItems = [{ label: "Inicio", href: "https://jteanalytics.cl/zagal/" }];

  return (
    <nav
      className="navbar navbar-expand-lg bg-white rounded-3 border mt-3 px-3"
      style={{ borderColor: "var(--dash-border)" }}
    >
      <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2 px-0">
        <a className="navbar-brand d-flex align-items-center gap-2 mb-0" href="#">
          <img src={lgoJte} alt="JTE Analytics" width={40} height={24} className="d-none d-sm-inline" />
          <img src={lgoZ} alt="Agrícola Zagal" width={52} height={52} />
          <div className="d-flex flex-column align-items-start lh-sm">
            <span className="h5 mb-0 fw-bold">Agrícola Zagal</span>
            <small className="text-muted">
              {PARCELA_LABEL}
              <span className="d-none d-sm-inline"> · Monitoreo de riego</span>
            </small>
          </div>
        </a>

        <div className="d-flex align-items-center gap-2 flex-grow-1 justify-content-lg-center order-2 order-lg-1">
          <span className={`badge rounded-pill ${freshnessClass}`} title="Última medición recibida">
            {freshnessText}
          </span>
          <small className="text-muted">
            Última medición: {formattedDate}
            {refreshing && (
              <span className="spinner-border spinner-border-sm ms-2" role="status">
                <span className="visually-hidden">Actualizando</span>
              </span>
            )}
          </small>
        </div>

        <div className="d-lg-none order-1 ms-auto">
          <BurgerMenu items={menuItems} />
        </div>

        <div className="d-none d-lg-flex gap-2 order-lg-2">
          {menuItems.map((item, i) => (
            <a key={i} className="btn btn-outline-primary btn-sm" href={item.href}>
              <i className="bi bi-house me-1" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
