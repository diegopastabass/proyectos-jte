import { useState } from "react";
import axios from "axios";
import { type User } from "../types";
import PhotoCaptureModal from "./PhotoCaptureModal"; // 1. Importar el modal

interface Props {
  user: User;
  onBack: () => void;
}

// Estructura fija de inputs requeridos
const FIELD_CONFIG = [
  { id: "horometro", label: "Horómetro", section: "Bomba", hasLocation: false },
  {
    id: "caudalimetro",
    label: "Caudalímetro (m³)",
    section: "Bomba",
    hasLocation: false,
  },
  { id: "kwh", label: "Energía (Kwh)", section: "Bomba", hasLocation: false },
  {
    id: "cloro_bomba",
    label: "Cloro en la Red",
    section: "Bomba",
    hasLocation: false,
  },
  {
    id: "cloro_red_1",
    label: "Cloro Red Punto 1",
    section: "Red",
    hasLocation: true,
  },
  {
    id: "cloro_red_2",
    label: "Cloro Red Punto 2",
    section: "Red",
    hasLocation: true,
  },
];

export default function CreateSession({ user, onBack }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);

  // 2. Estados para el manejo del modal de cámara
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState("");
  const [activeFieldLabel, setActiveFieldLabel] = useState("");

  // 3. Función para abrir el modal y saber qué campo lo invocó
  const handleOpenCamera = (fieldId: string, fieldLabel: string) => {
    setActiveFieldId(fieldId);
    setActiveFieldLabel(fieldLabel);
    setShowCameraModal(true);
  };

  // 4. Callback que recibe la foto tomada desde el modal
  const handlePhotoCaptured = (file: File, fieldId: string) => {
    setFiles((prev) => ({ ...prev, [fieldId]: file }));
    // El modal se cierra solo dentro del componente hijo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación simple: verificar que todos los campos tengan foto
    const missingPhotos = FIELD_CONFIG.some((field) => !files[field.id]);
    if (missingPhotos) {
      alert(
        "Por favor, tome una fotografía para cada medición antes de guardar.",
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      const measurementsPayload: any[] = [];
      const now = new Date().toISOString();

      // Construir el payload ordenado
      FIELD_CONFIG.forEach((field) => {
        // 1. Datos JSON
        measurementsPayload.push({
          name: field.label,
          value: parseFloat(values[field.id] || "0"),
          time: now,
          location: field.hasLocation ? locations[field.id] : "",
        });

        // 2. Archivos (Garantizado que existe por la validación inicial)
        const file = files[field.id];
        if (file) {
          formData.append("files", file);
        }
      });

      // Agregar el JSON String
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
      // Ajusta la URL si es necesario
      await axios.post(
        "https://app.jteanalytics.cl/ranguil-mediciones/sessions/app/",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      alert("Mediciones guardadas correctamente");
      onBack(); // Volver al home
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

  // Función auxiliar para renderizar los campos
  const renderFields = (sectionName: string) => {
    return FIELD_CONFIG.filter((f) => f.section === sectionName).map(
      (field) => {
        const hasPhoto = !!files[field.id];

        return (
          <div
            key={field.id}
            className="row mb-4 bg-light p-3 rounded shadow-sm align-items-end"
          >
            {/* Input de Valor */}
            <div className="col-md-4 mb-3 mb-md-0">
              <label className="form-label fw-bold small">{field.label}</label>
              <div className="input-group">
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="Ingresar valor"
                  required
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
              </div>
            </div>

            {/* Input de Ubicación (Si aplica) */}
            {field.hasLocation && (
              <div className="col-md-4 mb-3 mb-md-0">
                <label className="form-label small fw-bold">Ubicación</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Sector Norte"
                  required
                  value={locations[field.id] || ""}
                  onChange={(e) =>
                    setLocations({ ...locations, [field.id]: e.target.value })
                  }
                />
              </div>
            )}

            {/* 5. Botón de Cámara (Reemplaza al input type file) */}
            <div className={field.hasLocation ? "col-md-4" : "col-md-8"}>
              <label className="form-label small fw-bold d-block">
                Registro Fotográfico
              </label>
              <div className="d-grid">
                <button
                  type="button"
                  // Cambia el color si ya hay foto tomada
                  className={`btn ${hasPhoto ? "btn-success" : "btn-outline-primary"} d-flex align-items-center justify-content-center gap-2`}
                  onClick={() => handleOpenCamera(field.id, field.label)}
                >
                  <i
                    className={`bi ${hasPhoto ? "bi-check-circle-fill" : "bi-camera-fill"}`}
                  ></i>
                  {hasPhoto ? "Foto Tomada (Cambiar)" : "Tomar Foto"}
                </button>
              </div>
              {hasPhoto && (
                <small className="text-success d-block mt-1">
                  <i className="bi bi-check"></i> Lista para subir
                </small>
              )}
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

      <form onSubmit={handleSubmit} className="card p-4 shadow">
        {/* Sección BOMBA */}
        <h5 className="text-secondary border-bottom pb-2 mb-3">
          <i className="bi bi-droplet-half me-2"></i>Medición en Caseta
        </h5>
        {renderFields("Bomba")}

        {/* Sección RED */}
        <h5 className="text-secondary border-bottom pb-2 mb-3 mt-5">
          <i className="bi bi-geo-alt me-2"></i>En la Red
        </h5>
        {renderFields("Red")}

        <div className="mt-5">
          <button
            type="submit"
            className="btn btn-primary btn-lg w-100 py-3 fw-bold"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Subiendo sesión...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload-fill me-2"></i> Finalizar y
                Guardar Sesión
              </>
            )}
          </button>
        </div>
      </form>

      {/* 6. Renderizar el Modal de Cámara */}
      <PhotoCaptureModal
        show={showCameraModal}
        onHide={() => setShowCameraModal(false)}
        onCapture={handlePhotoCaptured}
        fieldId={activeFieldId}
        fieldLabel={activeFieldLabel}
      />
    </div>
  );
}
