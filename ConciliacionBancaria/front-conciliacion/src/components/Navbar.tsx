import { useState } from "react";
import { NavLink } from "react-router-dom";
import logoJte from "../assets/logo_jt2.png";
import { ROLES } from "../formato";
import { useSesion } from "../sesion";
import CambiarPassword from "./CambiarPassword";

const ENLACES = [
  { a: "/", texto: "Resumen", icono: "bi-speedometer2" },
  { a: "/bandeja", texto: "Bandeja", icono: "bi-inbox" },
  { a: "/movimientos", texto: "Movimientos", icono: "bi-bank" },
  { a: "/documentos", texto: "Documentos", icono: "bi-receipt" },
  { a: "/importar", texto: "Importar", icono: "bi-upload", rol: "operador" as const },
  { a: "/configuracion", texto: "Configuración", icono: "bi-gear" },
];

export default function Navbar() {
  const { usuario, empresas, empresa, rol, elegirEmpresa, logout, puede } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [usuarioAbierto, setUsuarioAbierto] = useState(false);
  const [cambiarPass, setCambiarPass] = useState(false);
  if (!usuario) return null;

  return (
    <>
      <nav className="navbar navbar-expand-xl navbar-dark bg-dark px-3 shadow-sm">
        <div className="container-fluid">
          {/* Marca y Logo */}
          <span className="navbar-brand d-flex align-items-center gap-2">
            <img src={logoJte} alt="Logo JT" style={{ height: "32px", width: "auto" }} />
            <span className="h5 mb-0 fw-bold">Conciliación</span>
          </span>

          <button className="navbar-toggler" type="button" aria-label="Menú" onClick={() => setMenuAbierto(!menuAbierto)}>
            <span className="navbar-toggler-icon" />
          </button>

          <div className={`collapse navbar-collapse ${menuAbierto ? "show" : ""}`}>
            <ul className="navbar-nav me-auto mb-2 mb-xl-0">
              {ENLACES.filter((e) => !e.rol || puede(e.rol)).map((e) => (
                <li className="nav-item" key={e.a}>
                  <NavLink to={e.a} end={e.a === "/"} className="nav-link" onClick={() => setMenuAbierto(false)}>
                    <i className={`bi ${e.icono} me-1`} />
                    {e.texto}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="d-flex flex-wrap align-items-center gap-3 text-white">
              {/* Selector de empresa (solo si hay más de una) */}
              {empresas.length > 1 ? (
                <select
                  className="form-select form-select-sm bg-dark text-white border-secondary"
                  style={{ maxWidth: 280 }}
                  value={empresa?.id ?? ""}
                  onChange={(e) => elegirEmpresa(Number(e.target.value))}
                  aria-label="Empresa"
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razonSocial}
                    </option>
                  ))}
                </select>
              ) : (
                empresa && (
                  <small className="text-white-50 text-truncate d-inline-block" style={{ maxWidth: 240 }} title={empresa.razonSocial}>
                    {empresa.razonSocial}
                  </small>
                )
              )}

              {/* Información de Usuario y Logout */}
              <div className="position-relative">
                <button
                  className="btn btn-link text-white text-decoration-none d-flex flex-column align-items-end p-0"
                  onClick={() => setUsuarioAbierto(!usuarioAbierto)}
                >
                  <span className="fw-bold">
                    {usuario.nombre} <i className="bi bi-caret-down-fill small" />
                  </span>
                  {rol && (
                    <small className="badge bg-secondary text-light" style={{ fontSize: "0.7rem" }}>
                      {usuario.esAdmin ? "Administrador general" : ROLES[rol]}
                    </small>
                  )}
                </button>
                {usuarioAbierto && (
                  <div className="dropdown-menu dropdown-menu-end show" style={{ right: 0, left: "auto" }}>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setUsuarioAbierto(false);
                        setCambiarPass(true);
                      }}
                    >
                      <i className="bi bi-key me-2" />
                      Cambiar contraseña
                    </button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item text-danger" onClick={logout}>
                      <i className="bi bi-box-arrow-right me-2" />
                      Salir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
      {cambiarPass && <CambiarPassword onCerrar={() => setCambiarPass(false)} />}
    </>
  );
}
