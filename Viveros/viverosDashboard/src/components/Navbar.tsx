import logoWeb from "../assets/logo-web.svg";

interface NavbarProps {
  children?: React.ReactNode;
}

/** Barra superior: marca del cliente y acciones (informe, Excel, ingreso). */
function Navbar({ children }: NavbarProps) {
  return (
    <nav className="barra-superior">
      <div className="d-flex align-items-center gap-3 min-w-0">
        <img src={logoWeb} alt="Viveros El Tambo" width={96} height={46} />
        <div className="min-w-0">
          <h1 className="h6 mb-0 fw-semibold">Monitoreo de cámaras de frío y calor</h1>
          <div className="small text-body-secondary">Temperatura, humedad y VPD · hora de Chile</div>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2 justify-content-end">{children}</div>
    </nav>
  );
}

export default Navbar;
