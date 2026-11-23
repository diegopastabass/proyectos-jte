import { useCallback, useState } from "react";
import { ORDEN_ZONAS, REFRESCO_ESTADO_MS, REFRESCO_SERIES_MS, type ZonaId } from "../config";
import { getConfig, getEstado, getSerieHoras } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import type { Config, Estado, PuntoSerie } from "../lib/tipos";
import Navbar from "../components/Navbar";
import ZonaCard from "../components/ZonaCard";
import Evolucion from "../components/Evolucion";
import Cumplimiento from "../components/Cumplimiento";
import ExportModal from "../components/ExportModal";
import InformeModal from "../components/InformeModal";
import LoginModal from "../components/LoginModal";
import AdminModal from "../components/AdminModal";
import Loading from "./Loading";
import logoJte from "../assets/logoJte.png";

function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [series24, setSeries24] = useState<Partial<Record<ZonaId, PuntoSerie[]>>>({});
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<"excel" | "informe" | "login" | "admin" | null>(null);
  const [sesion, setSesion] = useState<{ role: string; token: string } | null>(null);

  // Cada recurso se pide por separado: si uno falla, los demás se actualizan
  // y se conserva el último valor bueno del que falló.
  const cargarEstado = useCallback(() => {
    Promise.allSettled([getConfig(), getEstado()]).then(([c, e]) => {
      if (c.status === "fulfilled") setConfig(c.value);
      if (e.status === "fulfilled") {
        setEstado(e.value);
        setError(null);
      } else {
        setError("No se pudo actualizar el estado. Se muestran los últimos datos recibidos.");
      }
    });
  }, []);
  usePolling(cargarEstado, REFRESCO_ESTADO_MS);

  usePolling(() => {
    for (const z of ORDEN_ZONAS) {
      getSerieHoras(z, 24)
        .then((s) => setSeries24((prev) => ({ ...prev, [z]: s })))
        .catch(() => undefined);
    }
  }, REFRESCO_SERIES_MS);

  if (!estado || !config) {
    return error ? <p className="text-center mt-5">{error}</p> : <Loading />;
  }

  const configDe = (id: ZonaId) => config.zonas.find((z) => z.id === id)!;

  return (
    <div className="contenedor">
      <Navbar>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModal("informe")}>
          <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" />
          Informe PDF
        </button>
        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => setModal("excel")} aria-label="Exportar a Excel">
          <i className="bi bi-file-earmark-excel me-1" aria-hidden="true" />
          Excel
        </button>
        {sesion ? (
          <>
            {sesion.role === "0" && (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setModal("admin")}>
                <i className="bi bi-sliders me-1" aria-hidden="true" />
                Rangos
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setSesion(null)}>
              Salir
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setModal("login")}>
            Ingresar
          </button>
        )}
      </Navbar>

      {error && <div className="alert alert-warning py-2 small mb-0">{error}</div>}

      <div className="row g-3">
        {ORDEN_ZONAS.map((id) => {
          const zona = estado.zonas.find((z) => z.id === id);
          return zona ? (
            <div className="col-12 col-xl-4" key={id}>
              <ZonaCard zona={zona} config={configDe(id)} serie={series24[id] ?? []} />
            </div>
          ) : null;
        })}
      </div>

      <Evolucion config={config.zonas} series24={series24} />
      <Cumplimiento config={config.zonas} />

      <footer className="d-flex flex-wrap justify-content-center align-items-center gap-2 py-3 border-top text-body-secondary small">
        <span>&copy; {new Date().getFullYear()} JTE Analytics</span>
        <img src={logoJte} alt="JTE Analytics" width={40} height={22} />
      </footer>

      <ExportModal show={modal === "excel"} config={config.zonas} onClose={() => setModal(null)} />
      <InformeModal show={modal === "informe"} onClose={() => setModal(null)} />
      <LoginModal
        show={modal === "login"}
        onClose={() => setModal(null)}
        onLoginSuccess={(role, token) => setSesion({ role, token })}
      />
      {sesion?.role === "0" && (
        <AdminModal
          show={modal === "admin"}
          token={sesion.token}
          config={config}
          onClose={() => setModal(null)}
          onGuardado={(c) => {
            setConfig(c);
            cargarEstado();
          }}
        />
      )}
    </div>
  );
}

export default Home;
