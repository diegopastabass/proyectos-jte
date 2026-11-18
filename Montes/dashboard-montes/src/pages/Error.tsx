import React from "react";

const ErrorPage: React.FC = () => {
  return (
    <main className="min-vh-100 d-flex align-items-center bg-body-tertiary">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8 text-center">
            <span className="badge text-bg-danger mb-3">Sin conexión</span>
            <h1 className="display-5 fw-bold mb-2">No se pudieron cargar los datos</h1>
            <p className="lead text-body-secondary mb-4">
              El servidor no respondió. Revisa tu conexión a internet e intenta nuevamente en unos minutos.
            </p>

            <div className="d-flex gap-2 justify-content-center">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Volver a Intentar
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ErrorPage;
