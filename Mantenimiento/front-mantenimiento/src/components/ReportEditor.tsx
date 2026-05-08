import { useState } from "react";
import { type ReportData, type Material, type CapturedImage } from "../types";
import PhotoCaptureModal from "./PhotoCaptureModal";
import { v4 as uuidv4 } from "uuid";

// Campos de contexto predefinidos para guiar al técnico.
// El técnico puede usar cualquiera de ellos, o todos, según el trabajo realizado.
const PHOTO_FIELDS = [
  { id: "before", label: "Estado Inicial / Antes" },
  { id: "after", label: "Estado Final / Después" },
  { id: "detail", label: "Detalle Técnico" },
  { id: "material", label: "Repuesto / Material" },
  { id: "other", label: "Otra Vista" },
];

interface Props {
  data: ReportData;
  onChange: (field: keyof ReportData, value: any) => void;
  onNestedChange: (
    parent: "client" | "contact",
    field: string,
    value: string,
  ) => void;

  onSolutionChange: (index: number, value: string) => void;
  onAddSolution: () => void;
  onRemoveSolution: (index: number) => void;

  onObservationChange: (index: number, value: string) => void;
  onAddObservation: () => void;
  onRemoveObservation: (index: number) => void;

  onMaterialChange: (index: number, field: keyof Material, value: any) => void;
  onAddMaterial: () => void;
  onRemoveMaterial: (index: number) => void;

  onDevelopmentChange: (index: number, value: string) => void;
  onAddDevelopment: () => void;
  onRemoveDevelopment: (index: number) => void;

  onSubmit: () => void;
  isSaving: boolean;
  isEditing: boolean;
}

export const ReportEditor = ({
  data,
  onChange,
  onNestedChange,
  onSolutionChange,
  onAddSolution,
  onRemoveSolution,
  onObservationChange,
  onAddObservation,
  onRemoveObservation,
  onMaterialChange,
  onAddMaterial,
  onRemoveMaterial,
  onDevelopmentChange,
  onAddDevelopment,
  onRemoveDevelopment,
  onSubmit,
  isSaving,
}: Props) => {
  // Estado local del modal de cámara
  const [cameraModal, setCameraModal] = useState<{
    show: boolean;
    fieldId: string;
    fieldLabel: string;
  }>({ show: false, fieldId: "", fieldLabel: "" });

  const openCamera = (fieldId: string, fieldLabel: string) => {
    setCameraModal({ show: true, fieldId, fieldLabel });
  };

  const closeCamera = () => {
    setCameraModal((prev) => ({ ...prev, show: false }));
  };

  /**
   * Recibe el dataUrl desde PhotoCaptureModal y lo agrega al estado de ReportData.
   * Se genera un ID único para permitir eliminación individual.
   */
  const handleCapture = (dataUrl: string, fieldId: string) => {
    const field = PHOTO_FIELDS.find((f) => f.id === fieldId);
    const newImage: CapturedImage = {
      id: uuidv4(),
      dataUrl,
      fieldId,
      fieldLabel: field?.label ?? fieldId,
      capturedAt: new Date().toISOString(),
    };
    const updated = [...(data.capturedImages ?? []), newImage];
    onChange("capturedImages", updated);
  };

  /**
   * Elimina una imagen por su ID único del arreglo en ReportData.
   */
  const handleRemoveImage = (imageId: string) => {
    const updated = (data.capturedImages ?? []).filter(
      (img) => img.id !== imageId,
    );
    onChange("capturedImages", updated);
  };

  const capturedImages = data.capturedImages ?? [];

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()}>
        {/* ── INFORMACIÓN GENERAL ─────────────────────────────────────── */}
        <h5 className="mb-3">Información General</h5>
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label">Tipo de Atención</label>
            <select
              className="form-select"
              value={data.type}
              onChange={(e) => onChange("type", e.target.value)}
            >
              <option>Mantención Preventiva</option>
              <option>Atención de Falla</option>
              <option>Mejora en Infraestructura</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Inicio</label>
            <input
              type="datetime-local"
              className="form-control"
              value={data.startDate}
              onChange={(e) => onChange("startDate", e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Término</label>
            <input
              type="datetime-local"
              className="form-control"
              value={data.endDate}
              onChange={(e) => onChange("endDate", e.target.value)}
            />
          </div>
        </div>

        {/* ── DATOS DEL CLIENTE ────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Datos del Cliente</h5>
        <div className="mb-3">
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Nombre Cliente / Empresa"
            value={data.client.name}
            onChange={(e) => onNestedChange("client", "name", e.target.value)}
          />
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Dirección / Campo"
            value={data.client.address}
            onChange={(e) =>
              onNestedChange("client", "address", e.target.value)
            }
          />
          <input
            type="text"
            className="form-control"
            placeholder="Equipos"
            value={data.client.equipment}
            onChange={(e) =>
              onNestedChange("client", "equipment", e.target.value)
            }
          />
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Nombre Contacto"
              value={data.contact.name}
              onChange={(e) =>
                onNestedChange("contact", "name", e.target.value)
              }
            />
          </div>
          <div className="col-md-4">
            <input
              type="tel"
              className="form-control"
              placeholder="Teléfono"
              value={data.contact.phone}
              onChange={(e) =>
                onNestedChange("contact", "phone", e.target.value)
              }
            />
          </div>
          <div className="col-md-4">
            <input
              type="email"
              className="form-control"
              placeholder="Correo"
              value={data.contact.email}
              onChange={(e) =>
                onNestedChange("contact", "email", e.target.value)
              }
            />
          </div>
        </div>

        {/* ── DIAGNÓSTICO ──────────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Diagnóstico</h5>
        <div className="mb-3">
          <select
            className="form-select mb-3"
            value={data.status}
            onChange={(e) => onChange("status", e.target.value)}
          >
            <option>Sin Resolver</option>
            <option>Parcialmente Resuelto</option>
            <option>Resuelto</option>
          </select>
          <textarea
            className="form-control"
            rows={4}
            placeholder="Descripción general..."
            value={data.description}
            onChange={(e) => onChange("description", e.target.value)}
          />
        </div>

        {/* ── DESARROLLO ───────────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Desarrollo</h5>
        {data.developments?.map((dev, index) => (
          <div key={index} className="input-group mb-2">
            <span className="input-group-text">{index + 1}</span>
            <input
              type="text"
              className="form-control"
              placeholder="Actividad realizada..."
              value={dev}
              onChange={(e) => onDevelopmentChange(index, e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => onRemoveDevelopment(index)}
            >
              X
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAddDevelopment}
        >
          + Item Desarrollo
        </button>

        {/* ── SOLUCIÓN FINAL ───────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Solución Final</h5>
        {data.solutions.map((sol, index) => (
          <div key={index} className="input-group mb-2">
            <span className="input-group-text">{index + 1}</span>
            <input
              type="text"
              className="form-control"
              placeholder="Solución aplicada..."
              value={sol}
              onChange={(e) => onSolutionChange(index, e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => onRemoveSolution(index)}
            >
              X
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAddSolution}
        >
          + Item Solución
        </button>

        {/* ── OBSERVACIONES ────────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Observaciones Generales</h5>
        {data.observations.map((obs, index) => (
          <div key={index} className="input-group mb-2">
            <span className="input-group-text">•</span>
            <input
              type="text"
              className="form-control"
              placeholder="Observación..."
              value={obs}
              onChange={(e) => onObservationChange(index, e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => onRemoveObservation(index)}
            >
              X
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAddObservation}
        >
          + Item Observación
        </button>

        {/* ── MATERIALES ───────────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Repuestos / Materiales (Opcional)</h5>
        {data.materials.map((mat, index) => (
          <div key={index} className="row g-2 mb-2 align-items-center">
            <div className="col-12 col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Descripción"
                value={mat.description}
                onChange={(e) =>
                  onMaterialChange(index, "description", e.target.value)
                }
              />
            </div>
            <div className="col-5 col-md-2">
              <input
                type="number"
                className="form-control"
                placeholder="Cant."
                value={mat.quantity}
                onChange={(e) =>
                  onMaterialChange(index, "quantity", Number(e.target.value))
                }
              />
            </div>
            <div className="col-2 col-md-1 text-end">
              <button
                type="button"
                className="btn btn-outline-danger w-100"
                onClick={() => onRemoveMaterial(index)}
              >
                X
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAddMaterial}
        >
          + Agregar Material
        </button>

        {/* ── REGISTRO FOTOGRÁFICO ─────────────────────────────────────── */}
        <h5 className="mb-2 mt-4">Registro Fotográfico</h5>
        <p className="text-muted small mb-3">
          Opcional. Capture imágenes de respaldo del trabajo realizado. Se
          incluirán al final del informe PDF si hay fotos adjuntas.
        </p>

        {/* Botones de captura por contexto */}
        <div className="d-flex flex-wrap gap-2 mb-3">
          {PHOTO_FIELDS.map((field) => (
            <button
              key={field.id}
              type="button"
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
              onClick={() => openCamera(field.id, field.label)}
            >
              <i className="bi bi-camera"></i>
              {field.label}
            </button>
          ))}
        </div>

        {/* Galería de imágenes capturadas */}
        {capturedImages.length > 0 && (
          <div
            className="p-3 rounded-3 mb-3"
            style={{ background: "#f8f9fa", border: "1px solid #dee2e6" }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold text-secondary small">
                <i className="bi bi-images me-1"></i>
                {capturedImages.length} imagen
                {capturedImages.length !== 1 ? "es" : ""} adjunta
                {capturedImages.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="row g-2">
              {capturedImages.map((img) => (
                <div key={img.id} className="col-6 col-md-4 col-lg-3">
                  <div
                    className="position-relative rounded-2 overflow-hidden"
                    style={{
                      aspectRatio: "1",
                      background: "#e9ecef",
                      border: "1px solid #dee2e6",
                    }}
                  >
                    {/* Thumbnail */}
                    <img
                      src={img.dataUrl}
                      alt={img.fieldLabel}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    {/* Overlay con etiqueta y botón de eliminar */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background:
                          "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                        padding: "20px 6px 6px",
                      }}
                    >
                      <span
                        className="text-white"
                        style={{
                          fontSize: "0.65rem",
                          lineHeight: 1.2,
                          display: "block",
                        }}
                      >
                        {img.fieldLabel}
                      </span>
                    </div>

                    {/* Botón eliminar (esquina superior derecha) */}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm d-flex align-items-center justify-content-center p-0"
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        lineHeight: 1,
                        opacity: 0.9,
                      }}
                      title="Eliminar imagen"
                      onClick={() => handleRemoveImage(img.id)}
                    >
                      <i
                        className="bi bi-x"
                        style={{ fontSize: "0.85rem" }}
                      ></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FIRMAS ───────────────────────────────────────────────────── */}
        <h5 className="mb-3 mt-4">Firmas</h5>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">Técnico</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nombre Técnico"
              value={data.techName}
              onChange={(e) => onChange("techName", e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Cliente</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nombre quien recibe"
              value={data.clientSigner}
              onChange={(e) => onChange("clientSigner", e.target.value)}
            />
          </div>
        </div>

        {/* ── SUBMIT ───────────────────────────────────────────────────── */}
        <div className="d-grid gap-2 mt-4 pb-3">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              "Guardando..."
            ) : (
              <>
                <i className="bi bi-pen"></i> Iniciar Proceso de Cierre y Firmas
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal de cámara — renderizado fuera del <form> para evitar submit */}
      <PhotoCaptureModal
        show={cameraModal.show}
        onHide={closeCamera}
        onCapture={handleCapture}
        fieldId={cameraModal.fieldId}
        fieldLabel={cameraModal.fieldLabel}
      />
    </>
  );
};
