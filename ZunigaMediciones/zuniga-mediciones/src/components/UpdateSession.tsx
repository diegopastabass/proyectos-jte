import { useState } from "react";
import axios from "axios";
import { type User } from "../types";
import PhotoCaptureModal from "./PhotoCaptureModal";

interface Props {
  user: User;
  sessionId: string;
  onBack: () => void;
}

export default function UpdateSession({ sessionId, onBack }: Props) {
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handlePhotoCaptured = (capturedFile: File) => {
    setFile(capturedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!value || value === "") {
      alert("Debe ingresar el valor del cloro en la Red.");
      return;
    }

    if (!file) {
      alert("Debe adjuntar la fotografía del punto de medición.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();

      const dataJson = {
        measurement: {
          name: "Cloro Red Punto 2",
          value: parseFloat(value),
          location: location,
        },
      };

      formData.append("data", JSON.stringify(dataJson));
      formData.append("files", file);

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

      alert("¡Sesión completada con la segunda medición de cloro!");
      onBack();
    } catch (error: any) {
      console.error(error);
      alert(
        "Error al completar la sesión: " +
          (error.response?.data?.message || error.message || "Desconocido"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "600px" }}>
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
            <i className="bi bi-hourglass-split me-2"></i>
            Completar Sesión #{sessionId}
          </h4>
          <small className="text-muted">Segunda medición de cloro — Tarde</small>
        </div>
      </div>

      {/* Aviso contextual */}
      <div className="alert alert-info d-flex align-items-start gap-2 mb-4">
        <i className="bi bi-info-circle-fill fs-5 mt-1"></i>
        <div>
          <strong>Medición de la tarde</strong>
          <p className="mb-0 small mt-1">
            Ingrese el valor de <strong>Cloro Red Punto 2</strong> tomado en
            esta segunda ronda. El sistema registrará automáticamente la hora
            actual como timestamp de esta medición.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 shadow">
        <h5 className="text-secondary border-bottom pb-2 mb-4">
          <i className="bi bi-geo-alt me-2"></i>Cloro Red Punto 2
        </h5>

        {/* Valor */}
        <div className="mb-3">
          <label className="form-label fw-bold">
            Valor de Cloro <span className="text-danger">*</span>
          </label>
          <div className="input-group">
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control form-control-lg"
              placeholder="Ej: 0.45"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <span className="input-group-text">mg/L</span>
          </div>
        </div>

        {/* Ubicación */}
        <div className="mb-4">
          <label className="form-label fw-bold">Ubicación del Punto</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ej: Sector Sur, Calle Larga"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Foto */}
        <div className="mb-4">
          <label className="form-label fw-bold d-block">
            Registro Fotográfico <span className="text-danger">*</span>
          </label>
          <div className="d-grid">
            <button
              type="button"
              className={`btn ${file ? "btn-success" : "btn-outline-primary"} d-flex align-items-center justify-content-center gap-2`}
              onClick={() => setShowCamera(true)}
            >
              <i
                className={`bi ${file ? "bi-check-circle-fill" : "bi-camera-fill"}`}
              ></i>
              {file ? "Foto Lista — Cambiar" : "Tomar Fotografía"}
            </button>
          </div>
          {file && (
            <p className="text-success small mt-2 mb-0">
              <i className="bi bi-paperclip me-1"></i>
              {file.name}
            </p>
          )}
        </div>

        {/* Botón enviar */}
        <button
          type="submit"
          className="btn btn-warning btn-lg w-100 fw-bold py-3"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Guardando medición...
            </>
          ) : (
            <>
              <i className="bi bi-check2-circle me-2"></i>
              Confirmar y Completar Sesión
            </>
          )}
        </button>
      </form>

      {/* Modal cámara */}
      <PhotoCaptureModal
        show={showCamera}
        onHide={() => setShowCamera(false)}
        onCapture={handlePhotoCaptured}
        fieldId="cloro_red_2"
        fieldLabel="Cloro Red Punto 2"
      />
    </div>
  );
}
