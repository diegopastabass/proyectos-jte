import React, { useEffect, useState } from "react";
import { Vehicle, User, ViewState } from "../types";
import VehicleCard from "./VehicleCard";
import EditVehicleModal from "./EditVehicleModal";
import ConfirmationModal from "./ConfirmationModal";
import Loading from "./Loading";
import api from "../api";

interface VehicleListProps {
  user: User;
  setViewState: (view: ViewState) => void;
  setSelectedVehicle: (vehicle: Vehicle) => void;
  addToast: (
    msg: string,
    type: "success" | "error" | "warning" | "info",
  ) => void;
}

const VehicleList: React.FC<VehicleListProps> = ({
  user,
  setViewState,
  setSelectedVehicle,
  addToast,
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVehicleForEdit, setSelectedVehicleForEdit] =
    useState<Vehicle | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const response = await api.get("/vehicles");
      setVehicles(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (error) {
      addToast("Error al cargar vehículos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleStartChecklist = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setViewState("checklist-form");
  };

  const handleEdit = (vehicle: Vehicle) => {
    setSelectedVehicleForEdit(vehicle);
    setShowEditModal(true);
  };

  const handleDeleteClick = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await api.delete(`/vehicles/${vehicleToDelete.id}`);
      setVehicles(vehicles.filter((v) => v.id !== vehicleToDelete.id));
      addToast("Vehículo eliminado", "success");
    } catch (error) {
      addToast("Error al eliminar vehículo", "error");
    } finally {
      setShowDeleteModal(false);
      setVehicleToDelete(null);
    }
  };

  const saveVehicle = async (vehicle: Partial<Vehicle>) => {
    try {
      if (vehicle.id) {
        const res = await api.patch(`/vehicles/${vehicle.id}`, vehicle);
        setVehicles(
          vehicles.map((v) =>
            v.id === vehicle.id ? (res.data as Vehicle) : v,
          ),
        );
        addToast("Vehículo actualizado", "success");
      } else {
        const res = await api.post('/vehicles', vehicle);
        setVehicles([...vehicles, res.data as Vehicle]);
        addToast("Vehículo creado", "success");
      }
    } catch (error) {
      addToast("Error al guardar vehículo", "error");
    } finally {
      setShowEditModal(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-dark m-0">Flota de Vehículos</h4>
        {user.role === "admin" && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSelectedVehicleForEdit(null);
              setShowEditModal(true);
            }}
          >
            <i className="bi bi-plus-lg me-1"></i> Nuevo
          </button>
        )}
      </div>

      <div className="row g-3">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="col-12 col-md-6 col-lg-4">
            <VehicleCard
              vehicle={vehicle}
              onStartChecklist={() => handleStartChecklist(vehicle)}
              onEdit={
                user.role === "admin" ? () => handleEdit(vehicle) : undefined
              }
              onDelete={
                user.role === "admin"
                  ? () => handleDeleteClick(vehicle)
                  : undefined
              }
            />
          </div>
        ))}
        {(!vehicles || vehicles.length === 0) && (
          <div className="col-12 text-center py-5">
            <div className="glass-card p-5 d-inline-block border border-secondary border-opacity-25" style={{ maxWidth: '500px', width: '100%' }}>
              <i className="bi bi-car-front text-secondary mb-3" style={{ fontSize: "3.5rem" }}></i>
              <h4 className="text-dark fw-bold">No hay vehículos agregados</h4>
              <p className="text-secondary mb-4">Comienza agregando el primer vehículo a la flota para poder realizar los checklists.</p>
              {user.role === "admin" && (
                <button
                  className="btn btn-primary px-4 py-2 fw-medium"
                  onClick={() => {
                    setSelectedVehicleForEdit(null);
                    setShowEditModal(true);
                  }}
                >
                  <i className="bi bi-plus-lg me-2"></i> Agregar Vehículo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showEditModal && (
        <EditVehicleModal
          show={showEditModal}
          vehicle={selectedVehicleForEdit}
          onClose={() => setShowEditModal(false)}
          onSave={saveVehicle}
        />
      )}

      <ConfirmationModal
        show={showDeleteModal}
        title="Eliminar Vehículo"
        message={`¿Estás seguro de que deseas eliminar el vehículo ${vehicleToDelete?.patente}? Esta acción no se puede deshacer.`}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};

export default VehicleList;
