import logoJte from "../assets/logoJte.png";
import logoBoldos from "../assets/logoboldos.png";

const Loading = () => {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>

      <p className="mt-3 fs-5 fw-semibold">Cargando...</p>
      <img className="mb-5" src={logoJte} alt="logo" width={45} height={30} />
      <img className="mb-5" src={logoBoldos} alt="logoRng" width={250} />
      <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
        <p className="mb-0 text-body-secondary">&copy; 2025 JTE Analytics.</p>
      </footer>
    </div>
  );
};

export default Loading;
