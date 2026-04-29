interface FieldConfig {
  id: string;
  label: string;
  section: string;
}

interface Props {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  values: Record<string, string>;
  files: Record<string, File | null>;
  fieldConfig: FieldConfig[];
  loading: boolean;
}

export default function ConfirmationModal({
  show,
  onHide,
  onConfirm,
  values,
  files,
  fieldConfig,
  loading,
}: Props) {
  // Filtros para separar secciones
  const bombaFields = fieldConfig.filter((f) => f.section === "Bomba");
  const redFields = fieldConfig.filter((f) => f.section === "Red");

  // Detectar si hay datos en la red
  // Consideramos que hay datos si al menos un campo tiene valor O foto
  const hasRedData = redFields.some(
    (f) => (values[f.id] && values[f.id] !== "") || files[f.id],
  );

  return (
    <div
      className={`modal fade ${show ? "show d-block" : ""}`}
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-light">
            <h5 className="modal-title text-primary">
              <i className="bi bi-clipboard-check me-2"></i>
              Confirmar Guardado de Sesión
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onHide}
              disabled={loading}
            ></button>
          </div>
          <div className="modal-body">
            <p className="text-muted mb-4">
              Por favor revisa los datos antes de enviar. Las mediciones sin
              valor no serán registradas.
            </p>

            {/* Resumen Caseta (Obligatorio) */}
            <h6 className="border-bottom pb-2">💧 Mediciones en Caseta</h6>
            <div className="table-responsive mb-4">
              <table className="table table-sm table-bordered">
                <thead className="table-light">
                  <tr>
                    <th>Medición</th>
                    <th>Valor</th>
                    <th className="text-center">Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {bombaFields.map((field) => (
                    <tr key={field.id}>
                      <td>{field.label}</td>
                      <td>
                        {values[field.id] || (
                          <span className="text-danger fw-bold">Vacío</span>
                        )}
                      </td>
                      <td className="text-center">
                        {files[field.id] ? (
                          <span className="badge bg-success">Sí</span>
                        ) : (
                          <span className="badge bg-danger">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen Red (Opcional) */}
            <h6 className="border-bottom pb-2">🌍 Mediciones en Red</h6>
            {!hasRedData && (
              <div className="alert alert-warning d-flex align-items-center">
                <i className="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
                <div>
                  <strong>Atención:</strong> No se han registrado mediciones
                  para la Red. ¿Desea continuar de todas formas?
                </div>
              </div>
            )}

            {hasRedData && (
              <div className="table-responsive">
                <table className="table table-sm table-bordered">
                  <thead className="table-light">
                    <tr>
                      <th>Medición</th>
                      <th>Valor</th>
                      <th className="text-center">Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redFields.map((field) => {
                      const hasVal = values[field.id];
                      return (
                        <tr key={field.id}>
                          <td>{field.label}</td>
                          <td
                            className={!hasVal ? "text-muted font-italic" : ""}
                          >
                            {hasVal || "No registrado"}
                          </td>
                          <td className="text-center">
                            {files[field.id] ? (
                              <span className="badge bg-success">Sí</span>
                            ) : hasVal ? (
                              <span className="badge bg-warning text-dark">
                                Pendiente
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onHide}
              disabled={loading}
            >
              Volver y Editar
            </button>
            <button
              type="button"
              className="btn btn-primary fw-bold px-4"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-upload me-2"></i>
                  Confirmar y Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
