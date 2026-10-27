import React, { useState } from "react";
import { Link } from "react-router-dom";

/** Acción de la barra de navegación: enlace a otra pantalla o botón con callback. */
export interface NavAction {
  key: string;
  label: string;
  /** Clase de bootstrap-icons, p. ej. "bi-gear". */
  icon: string;
  to?: string;
  onClick?: () => void;
}

interface BurgerMenuProps {
  items: NavAction[];
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <button
        className="btn btn-outline-secondary d-md-none ms-auto"
        onClick={toggleMenu}
        aria-label="Abrir menú"
        aria-expanded={isOpen}
      >
        <i className="bi bi-list"></i>
      </button>

      {isOpen && <div className="menu-overlay" onClick={closeMenu}></div>}

      <div className={`burger-menu ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <div className="d-flex justify-content-between align-items-center px-3 pt-3">
          <strong>Menú</strong>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={closeMenu}
            aria-label="Cerrar menú"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <ul className="list-unstyled m-0 p-3">
          {items.map((item) => (
            <li key={item.key} className="mb-2">
              {item.to ? (
                <Link
                  to={item.to}
                  className="btn btn-outline-primary w-100 text-start"
                  onClick={closeMenu}
                >
                  <i className={`bi ${item.icon} me-2`}></i>
                  {item.label}
                </Link>
              ) : (
                <button
                  className="btn btn-outline-primary w-100 text-start"
                  onClick={() => {
                    closeMenu();
                    item.onClick?.();
                  }}
                >
                  <i className={`bi ${item.icon} me-2`}></i>
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Estilos en línea */}
      <style>{`
        .burger-menu {
          position: fixed;
          top: 0;
          right: 0;
          width: 260px;
          height: 100vh;
          background-color: #ffffff;
          color: #212529;
          box-shadow: -2px 0 5px rgba(0, 0, 0, 0.3);
          transform: translateX(100%);
          transition: transform 0.3s ease-in-out, visibility 0s linear 0.3s;
          z-index: 1051;
          visibility: hidden;
        }

        .burger-menu.open {
          transform: translateX(0);
          visibility: visible;
          transition: transform 0.3s ease-in-out, visibility 0s;
        }

        .menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 1050;
        }
      `}</style>
    </>
  );
};

export default BurgerMenu;
