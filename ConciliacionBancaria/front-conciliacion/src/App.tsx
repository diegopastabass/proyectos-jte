import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import api, { mensajeError } from "./api";
import { Alerta, Cargando, Vacio } from "./components/comunes";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Bandeja from "./pages/Bandeja";
import Configuracion from "./pages/Configuracion";
import Documentos from "./pages/Documentos";
import Importar from "./pages/Importar";
import Movimientos from "./pages/Movimientos";
import Resumen from "./pages/Resumen";
import { useSesion } from "./sesion";

export default function App() {
  const { usuario, empresa, iniciando, puede } = useSesion();

  if (!usuario) return <Login />;
  if (iniciando) return <Cargando texto="Iniciando sesión…" />;

  return (
    <>
      <Navbar />
      <main className="flex-grow-1">
        {!empresa ? (
          <SinEmpresa />
        ) : (
          // key: al cambiar de empresa se reinician filtros y datos de todas las pantallas.
          <Routes key={empresa.id}>
            <Route path="/" element={<Resumen />} />
            <Route path="/bandeja" element={<Bandeja />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/importar" element={puede("operador") ? <Importar /> : <Navigate to="/" />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </main>
    </>
  );
}

/** Primer uso: el administrador general crea la empresa (las demás se crean desde Configuración). */
function SinEmpresa() {
  const { usuario, recargarEmpresas } = useSesion();
  const [rut, setRut] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!usuario?.esAdmin) {
    return (
      <div className="container py-5">
        <Vacio icono="bi-building-slash" texto="Su usuario todavía no tiene acceso a ninguna empresa. Pídale acceso a un administrador." />
      </div>
    );
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await api.post("/empresas", { rut, razonSocial });
      await recargarEmpresas();
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 560 }}>
      <div className="card card-suave shadow-sm">
        <div className="card-body p-4">
          <h4 className="mb-1">Crear la primera empresa</h4>
          <p className="text-muted">Se crea con sus categorías iniciales y usted como administrador.</p>
          <Alerta error={error} />
          <form onSubmit={crear}>
            <div className="mb-3">
              <label className="form-label">RUT</label>
              <input className="form-control" placeholder="76.907.914-9" value={rut} onChange={(e) => setRut(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Razón social</label>
              <input className="form-control" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} required />
            </div>
            <button className="btn btn-primary" disabled={enviando}>
              Crear empresa
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
