import { type ReportData, type Material } from "../types";

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
  return (
    <form onSubmit={(e) => e.preventDefault()}>
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
          onChange={(e) => onNestedChange("client", "address", e.target.value)}
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
            onChange={(e) => onNestedChange("contact", "name", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <input
            type="tel"
            className="form-control"
            placeholder="Teléfono"
            value={data.contact.phone}
            onChange={(e) => onNestedChange("contact", "phone", e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <input
            type="email"
            className="form-control"
            placeholder="Correo"
            value={data.contact.email}
            onChange={(e) => onNestedChange("contact", "email", e.target.value)}
          />
        </div>
      </div>

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
  );
};
