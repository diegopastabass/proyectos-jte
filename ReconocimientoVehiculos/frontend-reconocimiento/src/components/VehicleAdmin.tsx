import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import type { User, Vehicle, Persona } from "../types";
import logo from "../assets/logoJte.png";

interface VehicleAdminProps {
  user: User;
  onLogout: () => void;
  onGoToHome: () => void;
}

interface SwipeState {
  startX: number;
  currentX: number;
  isSwiping: boolean;
  itemId: number | null;
}

export default function VehicleAdmin({
  user,
  onLogout,
  onGoToHome,
}: VehicleAdminProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  // Swipe state
  const [swipe, setSwipe] = useState<SwipeState>({
    startX: 0,
    currentX: 0,
    isSwiping: false,
    itemId: null,
  });
  const [revealedItem, setRevealedItem] = useState<{
    id: number;
    direction: "left" | "right";
  } | null>(null);

  // Edit modal
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editPatente, setEditPatente] = useState("");
  const [editPersonaId, setEditPersonaId] = useState<number>(0);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete modal
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const swipeThreshold = 70;
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load vehicles & personas
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vehiclesRes, personasRes] = await Promise.all([
        api.get("/vehiculos"),
        api.get("/personas"),
      ]);
      setVehicles(vehiclesRes.data);
      setPersonas(personasRes.data);
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter & sort
  const filtered = vehicles
    .filter((v) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        v.patente.toLowerCase().includes(q) ||
        (v.persona?.nombre ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const nameA = (a.persona?.nombre ?? "").toLowerCase();
      const nameB = (b.persona?.nombre ?? "").toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  // ===== Swipe handlers =====
  const handleTouchStart = (id: number, e: React.TouchEvent) => {
    // Close any previously revealed item if touching a different one
    if (revealedItem && revealedItem.id !== id) {
      setRevealedItem(null);
    }
    setSwipe({
      startX: e.touches[0].clientX,
      currentX: e.touches[0].clientX,
      isSwiping: true,
      itemId: id,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipe.isSwiping) return;
    setSwipe((prev) => ({ ...prev, currentX: e.touches[0].clientX }));
  };

  const handleTouchEnd = () => {
    if (!swipe.isSwiping || swipe.itemId === null) return;

    const diff = swipe.currentX - swipe.startX;

    if (diff < -swipeThreshold) {
      // Swiped left → Edit
      setRevealedItem({ id: swipe.itemId, direction: "left" });
    } else if (diff > swipeThreshold) {
      // Swiped right → Delete
      setRevealedItem({ id: swipe.itemId, direction: "right" });
    } else {
      // Not enough swipe, close
      setRevealedItem(null);
    }

    setSwipe({ startX: 0, currentX: 0, isSwiping: false, itemId: null });
  };

  const getSwipeOffset = (id: number): number => {
    if (swipe.isSwiping && swipe.itemId === id) {
      const diff = swipe.currentX - swipe.startX;
      // Clamp between -120 and 120
      return Math.max(-120, Math.min(120, diff));
    }
    if (revealedItem?.id === id) {
      return revealedItem.direction === "left" ? -100 : 100;
    }
    return 0;
  };

  // ===== Edit handlers =====
  const openEdit = (vehicle: Vehicle) => {
    setEditVehicle(vehicle);
    setEditPatente(vehicle.patente);
    setEditPersonaId(vehicle.personaId);
    setEditError("");
    setRevealedItem(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehicle) return;

    setEditLoading(true);
    setEditError("");

    try {
      await api.patch(`/vehiculos/${editVehicle.id}`, {
        patente: editPatente,
        personaId: editPersonaId,
      });
      setEditVehicle(null);
      await fetchData();
    } catch (err: any) {
      const msg =
        err.response?.data?.message?.message ||
        err.response?.data?.message ||
        "Error al actualizar vehículo";
      setEditError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setEditLoading(false);
    }
  };

  // ===== Delete handlers =====
  const openDelete = (vehicle: Vehicle) => {
    setDeleteVehicle(vehicle);
    setRevealedItem(null);
  };

  const handleDelete = async () => {
    if (!deleteVehicle) return;

    setDeleteLoading(true);
    try {
      await api.delete(`/vehiculos/${deleteVehicle.id}`);
      setDeleteVehicle(null);
      await fetchData();
    } catch (err) {
      console.error("Error al eliminar:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Close revealed item on outside tap
  const handleListTap = (id: number) => {
    if (revealedItem?.id === id) {
      setRevealedItem(null);
    }
  };

  return (
    <div className="container py-4 vh-100 d-flex flex-column">
      {/* Navbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 glass-panel px-3 py-2 px-md-4 py-md-3">
        <div className="d-flex align-items-center min-w-0">
          <img src={logo} alt="Logo" width={50} className="m-2" />
          <h5 className="mb-0 fw-bold text-dark text-truncate d-none d-sm-block">
            Vehículos
          </h5>
        </div>

        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <div className="d-none d-md-flex align-items-center me-2 text-dark">
            <span className="text-secondary me-1">Hola,</span>
            <strong className="text-truncate" style={{ maxWidth: "120px" }}>
              {user.username}
            </strong>
            <span className="badge bg-primary ms-2">{user.rol}</span>
          </div>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={onGoToHome}
            title="Volver al inicio"
          >
            <i className="bi bi-house-door"></i>
            <span className="d-none d-md-inline ms-1">Inicio</span>
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <i className="bi bi-box-arrow-right"></i>
            <span className="d-none d-md-inline ms-1">Salir</span>
          </button>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="glass-panel p-3 mb-3">
        <div className="row g-2 align-items-center">
          <div className="col">
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por patente o nombre del dueño..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>
          <div className="col-auto">
            <button
              className="btn btn-outline-primary d-flex align-items-center gap-1"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? "Ordenado A → Z" : "Ordenado Z → A"}
            >
              <i
                className={`bi ${sortAsc ? "bi-sort-alpha-down" : "bi-sort-alpha-up-alt"}`}
              ></i>
              <span className="d-none d-sm-inline">
                {sortAsc ? "A → Z" : "Z → A"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="text-center mb-2">
        <small className="text-secondary">
          <i className="bi bi-hand-index-thumb me-1"></i>
          Desliza a la izquierda para editar, a la derecha para eliminar
        </small>
      </div>

      {/* Vehicle List */}
      <div className="flex-grow-1 overflow-auto">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-secondary mt-3">Cargando vehículos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-inbox display-1 text-secondary"></i>
            <p className="text-secondary mt-3">
              {search
                ? "No se encontraron vehículos con esa búsqueda"
                : "No hay vehículos registrados"}
            </p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {filtered.map((vehicle) => {
              const offset = getSwipeOffset(vehicle.id);
              return (
                <div
                  key={vehicle.id}
                  className="vehicle-list-item-wrapper"
                >
                  {/* Action behind: Delete (left side, revealed on right swipe) */}
                  <div className="swipe-action swipe-action-delete">
                    <button
                      className="btn btn-danger h-100 d-flex align-items-center gap-2 px-4"
                      onClick={() => openDelete(vehicle)}
                    >
                      <i className="bi bi-trash3-fill fs-5"></i>
                      <span className="fw-semibold">Eliminar</span>
                    </button>
                  </div>

                  {/* Action behind: Edit (right side, revealed on left swipe) */}
                  <div className="swipe-action swipe-action-edit">
                    <button
                      className="btn btn-primary h-100 d-flex align-items-center gap-2 px-4"
                      onClick={() => openEdit(vehicle)}
                    >
                      <i className="bi bi-pencil-fill fs-5"></i>
                      <span className="fw-semibold">Editar</span>
                    </button>
                  </div>

                  {/* Main card content */}
                  <div
                    ref={(el) => {
                      if (el) itemRefs.current.set(vehicle.id, el);
                    }}
                    className="vehicle-list-item glass-panel p-3"
                    style={{
                      transform: `translateX(${offset}px)`,
                      transition: swipe.isSwiping && swipe.itemId === vehicle.id
                        ? "none"
                        : "transform 0.3s ease",
                    }}
                    onTouchStart={(e) => handleTouchStart(vehicle.id, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => handleListTap(vehicle.id)}
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-3 min-w-0">
                        <div className="vehicle-plate-badge">
                          {vehicle.patente}
                        </div>
                        <div className="min-w-0">
                          <div className="fw-semibold text-dark text-truncate">
                            {vehicle.persona?.nombre ?? "Sin dueño"}
                          </div>
                          <small className="text-secondary">
                            ID: {vehicle.id}
                          </small>
                        </div>
                      </div>
                      {/* Desktop hover actions */}
                      <div className="vehicle-desktop-actions d-none d-md-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(vehicle);
                          }}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(vehicle);
                          }}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash3"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Result count */}
      {!loading && (
        <div className="text-center mt-2">
          <small className="text-secondary">
            {filtered.length} de {vehicles.length} vehículo
            {vehicles.length !== 1 ? "s" : ""}
          </small>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editVehicle && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(30,41,59,0.65)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-pencil-square me-2 text-primary"></i>
                  Editar Vehículo
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditVehicle(null)}
                  disabled={editLoading}
                ></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  {editError && (
                    <div className="alert alert-danger py-2 small">
                      <i className="bi bi-exclamation-circle me-1"></i>
                      {editError}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Patente</label>
                    <input
                      type="text"
                      className="form-control text-uppercase fw-bold"
                      value={editPatente}
                      onChange={(e) =>
                        setEditPatente(e.target.value.toUpperCase())
                      }
                      maxLength={10}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Dueño</label>
                    <select
                      className="form-select"
                      value={editPersonaId}
                      onChange={(e) =>
                        setEditPersonaId(Number(e.target.value))
                      }
                      required
                    >
                      <option value={0} disabled>
                        Seleccionar dueño...
                      </option>
                      {personas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setEditVehicle(null)}
                    disabled={editLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={editLoading || editPersonaId === 0}
                  >
                    {editLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-1"></i> Guardar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteVehicle && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(30,41,59,0.65)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Confirmar Eliminación
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setDeleteVehicle(null)}
                  disabled={deleteLoading}
                ></button>
              </div>
              <div className="modal-body text-center p-4">
                <p className="text-dark mb-2">
                  ¿Estás seguro de que deseas eliminar este vehículo?
                </p>
                <div className="vehicle-plate-badge d-inline-block mb-2">
                  {deleteVehicle.patente}
                </div>
                <p className="text-secondary mb-0">
                  Dueño: {deleteVehicle.persona?.nombre ?? "Sin dueño"}
                </p>
                <p className="text-danger small mt-2 mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="modal-footer border-0 justify-content-center">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4"
                  onClick={() => setDeleteVehicle(null)}
                  disabled={deleteLoading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3 me-1"></i> Eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
