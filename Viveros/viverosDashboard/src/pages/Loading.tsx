import logoWeb from "../assets/logo-web.svg";

const Loading = () => (
  <div className="d-flex flex-column justify-content-center align-items-center vh-100 gap-3">
    <img src={logoWeb} alt="Viveros El Tambo" width={220} height={105} />
    <div className="spinner-border text-success" role="status">
      <span className="visually-hidden">Cargando...</span>
    </div>
    <p className="text-body-secondary mb-0">Cargando datos de las cámaras…</p>
  </div>
);

export default Loading;
