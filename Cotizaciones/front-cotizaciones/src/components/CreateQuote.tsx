import { useState, useEffect } from "react";
import { type QuoteItem, type QuoteData, type Quote } from "../types";
import SaveSummaryModal from "./SaveSummaryModal";

interface Props {
  token: string;
  initialQuote?: Quote | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function CreateQuote({
  token,
  initialQuote,
  onCancel,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<QuoteData>(
    initialQuote
      ? initialQuote.data
      : {
          project: "",
          clientName: "",
          company: "",
          contact: "",
          email: "",
          items: [],
          generalDesc: "",
          deliveryTime: "",
          paymentTerms: "",
          considerations: "",
          subtotal: 0,
          iva: 0,
          total: 0,
        },
  );

  const [newItem, setNewItem] = useState<QuoteItem>({
    detail: "",
    qty: 1,
    unitPrice: 0,
  });

  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const sub = form.items.reduce(
      (acc, item) => acc + item.qty * item.unitPrice,
      0,
    );
    const iva = Math.round(sub * 0.19);
    setForm((f) => ({ ...f, subtotal: sub, iva: iva, total: sub + iva }));
  }, [form.items]);

  const addItem = () => {
    if (!newItem.detail) return;
    setForm({ ...form, items: [...form.items, newItem] });
    setNewItem({ detail: "", qty: 1, unitPrice: 0 });

    const detailInput = document.getElementById("newItemDetail");
    if (detailInput) detailInput.focus();
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const updatedItems = [...form.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setForm({ ...form, items: updatedItems });
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const removeItem = (index: number) => {
    const updatedItems = [...form.items];
    updatedItems.splice(index, 1);
    setForm({ ...form, items: updatedItems });
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.items.length === 0) {
      alert("Debes agregar al menos un ítem a la cotización");
      return;
    }
    setShowSummary(true);
  };

  const handleFinalSave = async () => {
    const url = initialQuote
      ? `https://app.jteanalytics.cl/cotizaciones/quotes/${initialQuote.id}`
      : `https://app.jteanalytics.cl/cotizaciones/quotes`;

    const method = initialQuote ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: form }),
      });

      if (res.ok) {
        setShowSummary(false);
        onSuccess();
      } else {
        alert("Error al guardar la cotización");
        setShowSummary(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión");
      setShowSummary(false);
    }
  };

  return (
    <>
      {showSummary && (
        <SaveSummaryModal
          data={form}
          isEditing={!!initialQuote}
          onConfirm={handleFinalSave}
          onCancel={() => setShowSummary(false)}
        />
      )}

      <div className="card shadow mb-4">
        <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
          <h4 className="mb-0">
            {initialQuote
              ? `Editar Cotización: ${initialQuote.folio}`
              : "Nueva Cotización"}
          </h4>
          <button
            className="btn btn-close btn-close-white"
            onClick={onCancel}
          ></button>
        </div>
        <div className="card-body">
          <form onSubmit={handlePreSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Proyecto</label>
                <input
                  className="form-control"
                  value={form.project}
                  onChange={(e) =>
                    setForm({ ...form, project: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Cliente / Empresa</label>
                <input
                  className="form-control"
                  value={form.clientName}
                  onChange={(e) =>
                    setForm({ ...form, clientName: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Empresa (Opcional)</label>
                <input
                  className="form-control"
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Contacto</label>
                <input
                  className="form-control"
                  value={form.contact}
                  onChange={(e) =>
                    setForm({ ...form, contact: e.target.value })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email Cliente</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <hr />

            <h5 className="mb-3">Ítems</h5>
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "60%" }}>Detalle</th>
                    <th style={{ width: "10%" }}>Cant.</th>
                    <th style={{ width: "15%" }}>Unitario</th>
                    <th style={{ width: "5%" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          className="form-control form-control-sm border-0 bg-transparent"
                          value={it.detail}
                          onChange={(e) =>
                            updateItem(idx, "detail", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm border-0 bg-transparent"
                          value={it.qty}
                          onChange={(e) =>
                            updateItem(idx, "qty", +e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm border-0 bg-transparent"
                          value={it.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, "unitPrice", +e.target.value)
                          }
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeItem(idx)}
                          tabIndex={-1}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="align-middle table-primary">
                    <td>
                      <input
                        id="newItemDetail"
                        className="form-control form-control-sm"
                        placeholder="Detalle del servicio/producto"
                        value={newItem.detail}
                        onChange={(e) =>
                          setNewItem({ ...newItem, detail: e.target.value })
                        }
                        onKeyDown={handleItemKeyDown}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={newItem.qty}
                        onChange={(e) =>
                          setNewItem({ ...newItem, qty: +e.target.value })
                        }
                        onKeyDown={handleItemKeyDown}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={newItem.unitPrice}
                        onChange={(e) =>
                          setNewItem({ ...newItem, unitPrice: +e.target.value })
                        }
                        onKeyDown={handleItemKeyDown}
                      />
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={addItem}
                        title="Agregar Item (Enter)"
                      >
                        <i className="bi bi-plus-lg"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <small className="text-muted fst-italic"></small>
            </div>

            <div className="d-flex justify-content-end mb-3 mt-3">
              <div
                className="card bg-light p-3 border"
                style={{ width: "300px" }}
              >
                <div className="d-flex justify-content-between">
                  <strong>Neto:</strong>{" "}
                  <span>${form.subtotal.toLocaleString()}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <strong>IVA (19%):</strong>{" "}
                  <span>${form.iva.toLocaleString()}</span>
                </div>
                <div className="d-flex justify-content-between fs-5 text-primary mt-2 border-top pt-2">
                  <strong>Total:</strong>{" "}
                  <span>${form.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <hr />

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label">Descripciones Generales</label>
                <textarea
                  className="form-control"
                  value={form.generalDesc}
                  onChange={(e) =>
                    setForm({ ...form, generalDesc: e.target.value })
                  }
                />
              </div>
              <div className="col-md-6 ">
                <label className="form-label">Plazos de Entrega</label>
                <textarea
                  className="form-control"
                  value={form.deliveryTime}
                  onChange={(e) =>
                    setForm({ ...form, deliveryTime: e.target.value })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Condiciones de Pago</label>
                <textarea
                  className="form-control"
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm({ ...form, paymentTerms: e.target.value })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Consideraciones</label>
                <textarea
                  className="form-control"
                  value={form.considerations}
                  onChange={(e) =>
                    setForm({ ...form, considerations: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-success btn-lg">
                {initialQuote ? "Revisar y Actualizar" : "Revisar y Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
