import lgoJte from "../assets/logoJte.png";
import logoA from "../assets/logo_A.png";
import logoB from "../assets/logo_B.png";
import logoInacap from "../assets/logo_inacap.png";
import lgon from "../assets/lgon.png";

const Loading = () => {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>

      <p className="mt-3 fs-5 fw-semibold">Cargando...</p>
      <img className="mb-5" src={lgon} alt="logonerquihue" width={200} />
      <img className="mb-5" src={lgoJte} alt="logo" width={45} height={30} />
      <img
        src={logoA}
        alt="logoProOhiggins"
        width={100}
        className="d-none d-md-block mb-5"
      />
      <img
        src={logoB}
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
