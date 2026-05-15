import { useState, useEffect } from "react";
import axios from "axios";
import { type User, type SessionData } from "../types";
import PhotoCaptureModal from "./PhotoCaptureModal";

interface Props {
  user: User;
  sessionId: string;
  sessionData: SessionData;
  onBack: () => void;
}

// Mediciones de cloro que el sistema rastrea
const CHLORO_FIELDS = [
  {
    id: "cloro_bomba",
    label: "Cloro en Caseta",
    hasLocation: false,
  },
  {
    id: "cloro_red_1",
    label: "Cloro Red Punto 1",
    hasLocation: true,
  },
  {
    id: "cloro_red_2",
    label: "Cloro Red Punto 2",
    hasLocation: true,
  },
];

interface MeasurementEntry {
  label: string;
  value: string;
  location: string;
  file: File | null;
}

export default function UpdateSession({
  sessionId,
  sessionData,
  onBack,
}: Props) {
  const [pendingFields, setPendingFields] = useState<typeof CHLORO_FIELDS>([]);
  const [entries, setEntries] = useState<Record<string, MeasurementEntry>>({});
  const [markComplete, setMarkComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [activeCameraField, setActiveCameraField] = useState("");

  const isLastEdit = (sessionData.update_count ?? 0) >= 2;

  useEffect(() => {
    // Determinar qué mediciones de cloro ya existen consultando el endpoint
    const fetchPending = async () => {
      try {
        const token = localStorage.getItem("user_token");
        const res = await axios.get(
          `https://app.jteanalytics.cl/zuniga-mediciones/sessions/app/${sessionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const existingNames: string[] = (res.data.measurements || []).map(
          (m: any) => m.name,
        );
        const pending = CHLORO_FIELDS.filter(
          (f) => !existingNames.includes(f.label),
        );
        setPendingFields(pending);

        // Inicializar entradas vacías para los campos pendientes
        const initial: Record<string, MeasurementEntry> = {};
        pending.forEach((f) => {
          initial[f.id] = { label: f.label, value: "", location: "", file: null };
        });
        setEntries(initial);
      } catch {
        // Si falla, mostrar todos los campos como pendientes
        const initial: Record<string, MeasurementEntry> = {};
        CHLORO_FIELDS.forEach((f) => {
          initial[f.id] = {
            label: f.label,
            value: "",
            location: "",
            file: null,
          };
        });
        setPendingFields(CHLORO_FIELDS);
        setEntries(initial);
      }
    };
    fetchPending();
  }, [sessionId]);

  const openCamera = (fieldId: string) => {
    setActiveCameraField(fieldId);
    setShowCamera(true);
  };

  const handlePhotoCaptured = (capturedFile: File, fieldId: string) => {
    setEntries((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], file: capturedFile },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filtrar solo los campos que tienen valor ingresado
    const filledFields = pendingFields.filter(
      (f) => entries[f.id]?.value && entries[f.id].value !== "",
    );

    if (filledFields.length === 0) {
      alert("Debe ingresar al menos una medición de cloro.");
      return;
    }

    // Verificar que cada campo con valor tenga su foto
    const missingPhoto = filledFields.find((f) => !entries[f.id]?.file);
    if (missingPhoto) {
      alert(
        `Debe adjuntar la fotografía para "${missingPhoto.label}".`,
      );
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();

      const measurements = filledFields.map((f) => ({
        name: entries[f.id].label,
        value: parseFloat(entries[f.id].value),
        location: entries[f.id].location || "",
      }));

      // Agregar archivos en el mismo orden que los measurements
      filledFields.forEach((f) => {
        if (entries[f.id].file) {
          formData.append("files", entries[f.id].file as File);
        }
      });

      // Si es la última edición permitida (3ra), marcar completa automáticamente
      const shouldComplete = isLastEdit || markComplete;

      formData.append(
        "data",
        JSON.stringify({ measurements, markComplete: shouldComplete }),
      );

      const token = localStorage.getItem("user_token");
      await axios.patch(
        `https://app.jteanalytics.cl/zuniga-mediciones/sessions/app/${sessionId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (shouldComplete) {
        alert("¡Sesión completada correctamente!");
      } else {
        alert("Medición(es) guardada(s). La sesión quedará pendiente para completar más tarde.");
      }
      onBack();
    } catch (error: any) {
      console.error(error);
      alert(
        "Error al guardar: " +
          (error.response?.data?.message || error.message || "Desconocido"),
      );
    } finally {
      setLoading(false);
    }
  };

  // Calcular ediciones restantes
  const editsUsed = sessionData.update_count ?? 0;
  const editsRemaining = 3 - editsUsed;

  return (
    <div className="container py-4" style={{ maxWidth: "700px" }}>
      {/* Header */}
      <div className="d-flex align-items-center mb-4 border-bottom pb-3">
        <button
          className="btn btn-outline-secondary me-3 btn-sm"
          onClick={onBack}
        >
          <i className="bi bi-arrow-left"></i> Volver
        </button>
        <div>
          <h4 className="mb-0 text-warning">
            <i className="bi bi-droplet-half me-2"></i>
            Completar Sesión #{sessionId}
          </h4>
          <small className="text-muted">
            Agregar mediciones de cloro pendientes
          </small>
        </div>
      </div>

      {/* Info de ediciones restantes */}
      <div
        className={`alert d-flex align-items-start gap-2 mb-4 ${
          isLastEdit ? "alert-danger" : "alert-info"
        }`}
      >
        <i
          className={`bi fs-5 mt-1 ${
            isLastEdit
              ? "bi-exclamation-octagon-fill"
              : "bi-info-circle-fill"
          }`}
        ></i>
        <div>
          <strong>
            {isLastEdit
              ? "Última edición permitida"
              : `Edición ${editsUsed + 1} de 3`}
          </strong>
          <p className="mb-0 small mt-1">
            {isLastEdit
              ? "Esta es la última edición permitida. La sesión se marcará como completa al guardar."
              : `Quedan ${editsRemaining} edición(es) disponibles. Puede guardar ahora y continuar más tarde.`}
          </p>
        </div>
      </div>

      {pendingFields.length === 0 ? (
        <div className="alert alert-success">
          <i className="bi bi-check-circle-fill me-2"></i>
          Todas las mediciones de cloro ya han sido ingresadas.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-4 shadow">
          <h5 className="text-secondary border-bottom pb-2 mb-4">
            <i className="bi bi-droplet me-2"></i>Mediciones de Cloro Pendientes
          </h5>

          {pendingFields.map((field) => {
            const entry = entries[field.id];
            if (!entry) return null;
            const hasPhoto = !!entry.file;

            return (
              <div
                key={field.id}
                className="row mb-4 p-3 rounded shadow-sm align-items-end"
                style={{ background: "#f8f9fa" }}
              >
                <div className="col-12 mb-2">
                  <span className="fw-bold text-secondary small text-uppercase">
                    {field.label}
                  </span>
                </div>

                {/* Valor */}
                <div className={field.hasLocation ? "col-md-4 mb-3 mb-md-0" : "col-md-6 mb-3 mb-md-0"}>
                  <label className="form-label small fw-bold">
                    Valor <span className="text-muted">(opcional)</span>
                  </label>
                  <div className="input-group">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="Ej: 0.45"
                      value={entry.value}
                      onChange={(e) =>
                        setEntries((prev) => ({
                          ...prev,
                          [field.id]: { ...prev[field.id], value: e.target.value },
                        }))
                      }
                    />
                    <span className="input-group-text">mg/L</span>
                  </div>
                </div>

                {/* Ubicación (solo para Red) */}
                {field.hasLocation && (
                  <div className="col-md-4 mb-3 mb-md-0">
                    <label className="form-label small fw-bold">Ubicación</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Sector Norte"
                      value={entry.location}
                      onChange={(e) =>
                        setEntries((prev) => ({
                          ...prev,
                          [field.id]: {
                            ...prev[field.id],
                            location: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                )}

                {/* Foto */}
                <div className={field.hasLocation ? "col-md-4" : "col-md-6"}>
                  <label className="form-label small fw-bold d-block">
                    Fotografía {entry.value ? <span className="text-danger">*</span> : null}
                  </label>
                  <div className="d-grid">
                    <button
                      type="button"
                      className={`btn ${hasPhoto ? "btn-success" : "btn-outline-primary"} d-flex align-items-center justify-content-center gap-2`}
                      onClick={() => openCamera(field.id)}
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
          })}

          {/* Toggle "Marcar como completa" (solo si no es la última edición) */}
          {!isLastEdit && (
            <div className="form-check form-switch mb-4 p-3 bg-light rounded border">
              <input
                className="form-check-input"
                type="checkbox"
                id="markCompleteSwitch"
                checked={markComplete}
                onChange={(e) => setMarkComplete(e.target.checked)}
              />
              <label className="form-check-label fw-bold" htmlFor="markCompleteSwitch">
                Marcar sesión como completa
              </label>
              <p className="text-muted small mb-0 mt-1">
                {markComplete
                  ? "La sesión quedará cerrada y no podrá modificarse más."
                  : "La sesión quedará pendiente. Podrá agregar más mediciones de cloro más tarde."}
              </p>
            </div>
          )}

          {/* Botón guardar */}
          <button
            type="submit"
            className={`btn btn-lg w-100 fw-bold py-3 ${
              markComplete || isLastEdit ? "btn-success" : "btn-warning"
            }`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Guardando...
              </>
            ) : markComplete || isLastEdit ? (
              <>
                <i className="bi bi-check2-circle me-2"></i>
                Guardar y Completar Sesión
              </>
            ) : (
              <>
                <i className="bi bi-save me-2"></i>
                Guardar y Dejar Pendiente
              </>
            )}
          </button>
        </form>
      )}

      {/* Modal cámara */}
      <PhotoCaptureModal
        show={showCamera}
        onHide={() => setShowCamera(false)}
        onCapture={handlePhotoCaptured}
        fieldId={activeCameraField}
        fieldLabel={
          pendingFields.find((f) => f.id === activeCameraField)?.label ?? ""
        }
      />
    </div>
  );
}
