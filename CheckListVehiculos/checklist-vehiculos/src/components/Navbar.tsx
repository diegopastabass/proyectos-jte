import React from "react";
import { User, ViewState } from "../types";
import logo from "../assets/logoJte.png";

interface NavbarProps {
  user: User;
  onLogout: () => void;
  setViewState: (view: ViewState) => void;
  currentView: ViewState;
}

const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  setViewState,
  currentView,
}) => {
  return (
    <nav
      className="navbar navbar-light glass-card m-2 px-3 py-2 sticky-top"
      style={{ borderRadius: "1rem", zIndex: 1020 }}
    >
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <a
          className="navbar-brand d-flex align-items-center"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setViewState("home");
          }}
        >
          <img src={logo} alt="Logo" width="40" className="me-2 rounded" />
          <span className="fw-bold d-none d-sm-inline text-dark">
            CheckList Vehículos
          </span>
        </a>

        {user.role === "admin" && (
          <ul className="navbar-nav flex-row gap-3">
            <li className="nav-item">
              <a
                className={`nav-link fw-bold ${currentView === "home" ? "text-primary border-bottom border-primary border-2" : "text-dark"}`}
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  setViewState("home");
                }}
              >
                Vehículos
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link fw-bold ${currentView === "checklist-list" || currentView === "checklist-detail" ? "text-primary border-bottom border-primary border-2" : "text-dark"}`}
                href="#checklist-list"
                onClick={(e) => {
                  e.preventDefault();
                  setViewState("checklist-list");
                }}
              >
                Checklists
              </a>
            </li>
          </ul>
        )}

        <div className="d-flex align-items-center">
          <div className="text-end me-3 d-none d-md-block">
            <div className="text-dark fw-medium">{user.name}</div>
            <div
              className="badge bg-primary text-uppercase"
              style={{ fontSize: "0.7rem" }}
            >
              {user.role}
            </div>
          </div>{" "}
          <button
            className="btn btn-outline-secondary rounded-circle"
            style={{ width: "30px", height: "30px", padding: 0 }}
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
