import React, { useState, useEffect } from "react";
import { Vehicle } from "../types";

interface EditVehicleModalProps {
  show: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (vehicle: Partial<Vehicle>) => void;
}

const EditVehicleModal: React.FC<EditVehicleModalProps> = ({
  show,
  vehicle,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Vehicle>>({});

  useEffect(() => {
    if (vehicle) {
      console.log("Vehicle data received in modal:", vehicle);
      setFormData(vehicle);
    } else {
      setFormData({
        model: "",
        patente: "",
        kilometraje: 0,
        km_ultima_mantencion: 0,
        fecha_venc_revision_tecnica: "",
        fecha_venc_circulacion: "",
        fecha_prox_mantencion: "",
      });
    }
  }, [vehicle]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!show) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: e.target.type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Remove empty string values for optional fields so they don't fail backend validation
    const cleanedData: Partial<Vehicle> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== "" && value !== null && value !== undefined) {
        (cleanedData as any)[key] = value;
      }
    }
    onSave(cleanedData);
  };

  return (
    <div
      className="modal d-block glass-modal"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.5)", overflowY: "auto" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content glass-card border-0">
          <div className="modal-header border-bottom border-secondary">
            <h5 className="modal-title text-dark">
              {vehicle ? "Editar Vehículo" : "Nuevo Vehículo"}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body text-dark">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label text-secondary">Patente</label>
                  <input
                    type="text"
                    className="form-control text-uppercase"
                    name="patente"
                    value={formData.patente || ""}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-secondary">Modelo</label>
                  <input
                    type="text"
                    className="form-control"
                    name="model"
                    value={formData.model || ""}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-secondary">
                    Kilometraje Actual
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="kilometraje"
                    value={formData.kilometraje ?? 0}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-secondary">
                    KM Última Mantención
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="km_ultima_mantencion"
                    value={formData.km_ultima_mantencion ?? 0}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-secondary">
                    Venc. Rev. Técnica
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    name="fecha_venc_revision_tecnica"
                    value={formData.fecha_venc_revision_tecnica || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-secondary">
                    Venc. Perm. Circ.
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    name="fecha_venc_circulacion"
                    value={formData.fecha_venc_circulacion || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-secondary">
                    KM para la próxima mantención
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light"
                    readOnly
                    value={`${(10000 - ((formData.kilometraje ?? 0) - (formData.km_ultima_mantencion ?? 0))).toLocaleString()} km`}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer border-top border-secondary">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditVehicleModal;
