import { useState } from "react";
import axios from "axios";
import { type User } from "../types";
import PhotoCaptureModal from "./PhotoCaptureModal";
import ConfirmationModal from "./ConfirmationModal";

interface Props {
  user: User;
  onBack: () => void;
}

const FIELD_CONFIG = [
  {
    id: "horometro",
    label: "Horómetro",
    section: "Bomba",
    hasLocation: false,
    required: true,
  },
  {
    id: "caudalimetro",
    label: "Caudalímetro",
    section: "Bomba",
    hasLocation: false,
    required: true,
  },
  {
    id: "kwh",
    label: "Energía",
    section: "Bomba",
    hasLocation: false,
    required: true,
  },
  {
    id: "nivel_estatico",
    label: "Nivel Estático",
    section: "Bomba",
    hasLocation: false,
    required: true,
  },
  {
    id: "nivel_dinamico",
    label: "Nivel Dinámico",
    section: "Bomba",
    hasLocation: false,
    required: true,
  },
  {
    id: "cloro_bomba",
    label: "Cloro en Caseta",
    section: "Bomba",
    hasLocation: false,
    required: false,
  },

  {
    id: "cloro_red_1",
    label: "Cloro Red Punto 1",
    section: "Red",
    hasLocation: true,
    required: false,
  },
  {
    id: "cloro_red_2",
    label: "Cloro Red Punto 2",
    section: "Red",
    hasLocation: true,
    required: false,
  },
];

export default function CreateSession({ user, onBack }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);

  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [activeFieldId, setActiveFieldId] = useState("");
  const [activeFieldLabel, setActiveFieldLabel] = useState("");

  const handleOpenCamera = (fieldId: string, fieldLabel: string) => {
    setActiveFieldId(fieldId);
    setActiveFieldLabel(fieldLabel);
    setShowCameraModal(true);
  };

  const handlePhotoCaptured = (file: File, fieldId: string) => {
    setFiles((prev) => ({ ...prev, [fieldId]: file }));
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFields = FIELD_CONFIG.filter((f) => f.required);
    const missingRequired = requiredFields.some(
      (field) =>
        !values[field.id] || values[field.id] === "" || !files[field.id],
    );

    if (missingRequired) {
      alert(
        "Todos los campos marcados como obligatorios requieren valor y fotografía.",
      );
      return;
    }

    const optionalFields = FIELD_CONFIG.filter((f) => !f.required);
    const incompleteOptional = optionalFields.some((field) => {
      const hasValue = values[field.id] && values[field.id] !== "";
      const hasPhoto = !!files[field.id];
      return hasValue && !hasPhoto;
    });

    if (incompleteOptional) {
      alert(
        "Si ingresa un valor en un campo opcional, debe adjuntar su fotografía.",
      );
      return;
    }

    setShowConfirmModal(true);
  };

  const handleFinalSave = async () => {
    setLoading(true);

    try {
      const formData = new FormData();
      const measurementsPayload: any[] = [];
      const now = new Date().toISOString();

      FIELD_CONFIG.forEach((field) => {
        const val = values[field.id];
        if (val && val !== "") {
          measurementsPayload.push({
            name: field.label,
            value: parseFloat(val),
            time: now,
            location: field.hasLocation ? locations[field.id] : "",
          });

          const file = files[field.id];
          if (file) {
            formData.append("files", file);
          }
        }
      });

      const dataJson = {
        userId: user.id,
        measurements: measurementsPayload,
        reportMetadata: {
          generatedBy: user.fullName,
          clientUserAgent: navigator.userAgent,
        },
      };

      formData.append("data", JSON.stringify(dataJson));

      const token = localStorage.getItem("user_token");
      await axios.post(
        "https://app.jteanalytics.cl/zuniga-mediciones/sessions/app/",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setShowConfirmModal(false);
      alert(`Mediciones guardadas correctamente`);
      onBack();
    } catch (error: any) {
      console.error(error);
      alert(
        "Error guardando sesión: " +
          (error.response?.data?.message || error.message || "Desconocido"),
      );
    } finally {
      setLoading(false);
    }
  };

  const renderFields = (sectionName: string) => {
    return FIELD_CONFIG.filter((f) => f.section === sectionName).map(
      (field) => {
        const hasPhoto = !!files[field.id];

        return (
          <div
            key={field.id}
            className="row mb-4 p-3 rounded shadow-sm align-items-end bg-light"
          >
            <div className="col-md-4 mb-3 mb-md-0">
              <label className="form-label fw-bold small">
                {field.label}
                {field.required && <span className="text-danger ms-1">*</span>}
              </label>
              <div className="input-group">
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder={field.required ? "Obligatorio" : "Opcional"}
                  required={field.required}
                  value={values[field.id] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [field.id]: e.target.value })
                  }
                />
                {field.id.includes("kwh") && (
                  <span className="input-group-text">kWh</span>
                )}
                {field.id.includes("caudalimetro") && (
                  <span className="input-group-text">m³</span>
                )}
                {field.id.includes("horometro") && (
                  <span className="input-group-text">h</span>
                )}
                {field.id.includes("nivel") && (
                  <span className="input-group-text">m</span>
                )}
                {field.id.includes("cloro") && (
                  <span className="input-group-text">mg/L</span>
                )}
              </div>
            </div>

            {field.hasLocation && (
              <div className="col-md-4 mb-3 mb-md-0">
                <label className="form-label small fw-bold">Ubicación</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Sector Norte"
                  value={locations[field.id] || ""}
                  onChange={(e) =>
                    setLocations({ ...locations, [field.id]: e.target.value })
                  }
                />
              </div>
            )}

            <div className={field.hasLocation ? "col-md-4" : "col-md-8"}>
              <label className="form-label small fw-bold d-block">
                Registro Fotográfico
              </label>
              <div className="d-grid">
                <button
                  type="button"
                  className={`btn ${hasPhoto ? "btn-success" : "btn-outline-primary"} d-flex align-items-center justify-content-center gap-2`}
                  onClick={() => handleOpenCamera(field.id, field.label)}
                >
                  <i
                    className={`bi ${hasPhoto ? "bi-check-circle-fill" : "bi-camera-fill"}`}
                  ></i>
                  {hasPhoto ? "Foto Lista" : "Tomar Foto"}
                </button>
              </div>
            </div>
          </div>
        );
      },
    );
  };

  return (
    <div className="container py-4" style={{ maxWidth: "800px" }}>
      <div className="d-flex align-items-center mb-4 border-bottom pb-3">
        <button
          className="btn btn-outline-secondary me-3 btn-sm"
          onClick={onBack}
        >
          <i className="bi bi-arrow-left"></i> Volver
        </button>
        <h4 className="mb-0 text-primary">Nueva Sesión de Medición</h4>
      </div>

      {/* Cambiamos handleSubmit por handlePreSubmit */}
      <form onSubmit={handlePreSubmit} className="card p-4 shadow">
        <h5 className="text-secondary border-bottom pb-2 mb-3">
          <i className="bi bi-droplet-half me-2"></i>Medición en Caseta
        </h5>
        {renderFields("Bomba")}

        <h5 className="text-secondary border-bottom pb-2 mb-3 mt-5">
          <i className="bi bi-geo-alt me-2"></i>Medición en la Red
        </h5>
        <p className="text-muted small">
          Ingrese valores solo si realizó mediciones en terreno.
        </p>
        {renderFields("Red")}

        <div className="mt-5">
          <button
            type="submit"
            className="btn btn-primary btn-lg w-100 py-3 fw-bold"
          >
            <i className="bi bi-arrow-right-circle me-2"></i> Revisar y Guardar
          </button>
        </div>
      </form>

      {/* Modal de Cámara */}
      <PhotoCaptureModal
        show={showCameraModal}
        onHide={() => setShowCameraModal(false)}
        onCapture={handlePhotoCaptured}
        fieldId={activeFieldId}
        fieldLabel={activeFieldLabel}
      />

      {/* Modal de Confirmación Nuevo */}
      <ConfirmationModal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        onConfirm={handleFinalSave}
        values={values}
        files={files}
        fieldConfig={FIELD_CONFIG}
        loading={loading}
      />
    </div>
  );
}
