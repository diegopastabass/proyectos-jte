import logoJte from "../assets/logoJte.png";
import logoProOhiggins from "../assets/logo_A.png";
import logoSecundarioB from "../assets/logo_B.png";
import logoInacap from "../assets/logo_inacap.png";

const Loading = () => {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>

      <p className="mt-3 fs-5 fw-semibold">Cargando...</p>
      <img className="mb-5" src={logoJte} alt="logo" width={45} height={30} />
      <img
        src={logoProOhiggins}
        alt="logoProOhiggins"
        width={100}
        className="d-none d-md-block mb-5"
      />
      <img
        src={logoSecundarioB}
        alt="logoSecundarioB"
        width={250}
        className="d-none d-md-block mb-5"
      />
      <img
        src={logoInacap}
        alt="logoSecundarioC"
        width={100}
        className="d-none d-md-block mb-5"
      />
      <footer className="d-flex flex-wrap justify-content-between align-items-center py-3 px-4 border-top">
        <p className="mb-0 text-body-secondary">&copy; 2025 JTE Analytics.</p>
      </footer>
    </div>
  );
};

export default Loading;
