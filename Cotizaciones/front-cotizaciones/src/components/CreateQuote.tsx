import { useState, useEffect } from "react";
import { type QuoteItem, type QuoteData } from "../types";

interface Props {
  token: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function CreateQuote({ token, onCancel, onSuccess }: Props) {
  const [form, setForm] = useState<QuoteData>({
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
  });

  const [newItem, setNewItem] = useState<QuoteItem>({
    detail: "",
    qty: 1,
    unitPrice: 0,
  });

  // Calcular totales automáticamente
  useEffect(() => {
    const sub = form.items.reduce(
      (acc, item) => acc + item.qty * item.unitPrice,
      0,
    );
    const iva = Math.round(sub * 0.19);
    setForm((f) => ({ ...f, subtotal: sub, iva: iva, total: sub + iva }));
  }, [form.items]);

  const addItem = () => {
    setForm({ ...form, items: [...form.items, newItem] });
    setNewItem({ detail: "", qty: 1, unitPrice: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(
        "https://app.jteanalytics.cl/cotizaciones/quotes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ data: form }),
        },
      );
      if (res.ok) onSuccess();
    } catch (err) {
      alert("Error al crear cotización");
    }
  };

  return (
    <div className="card shadow mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4>Nueva Cotización</h4>
        <button className="btn btn-close" onClick={onCancel}></button>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {/* Cliente */}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <input
                placeholder="Proyecto"
                className="form-control"
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <input
                placeholder="Cliente / Empresa"
                className="form-control"
                value={form.clientName}
                onChange={(e) =>
                  setForm({ ...form, clientName: e.target.value })
                }
                required
              />
            </div>
            <div className="col-md-6">
              <input
                placeholder="Contacto"
                className="form-control"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>
            <div className="col-md-6">
              <input
                placeholder="Email Cliente"
                type="email"
                className="form-control"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <hr />

          {/* Items */}
          <h5 className="mb-3">Ítems</h5>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Detalle</th>
                <th className="w-100">Cant.</th>
                <th className="w-150">Unitario</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.detail}</td>
                  <td>{it.qty}</td>
                  <td>${it.unitPrice}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const newItems = [...form.items];
                        newItems.splice(idx, 1);
                        setForm({ ...form, items: newItems });
                      }}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="table-light">
                <td>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Detalle del servicio/producto"
                    value={newItem.detail}
                    onChange={(e) =>
                      setNewItem({ ...newItem, detail: e.target.value })
                    }
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
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addItem}
                  >
                    +
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Resumen Económico */}
          <div className="d-flex justify-content-end mb-3">
            <div style={{ width: "250px" }}>
              <div className="d-flex justify-content-between">
                <strong>Neto:</strong> <span>${form.subtotal}</span>
              </div>
              <div className="d-flex justify-content-between">
                <strong>IVA (19%):</strong> <span>${form.iva}</span>
              </div>
              <div className="d-flex justify-content-between fs-5 text-primary">
                <strong>Total:</strong> <span>${form.total}</span>
              </div>
            </div>
          </div>

          <hr />

          {/* Condiciones */}
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <textarea
                placeholder="Descripciones Generales"
                className="form-control"
                rows={2}
                value={form.generalDesc}
                onChange={(e) =>
                  setForm({ ...form, generalDesc: e.target.value })
                }
              ></textarea>
            </div>
            <div className="col-md-6">
              <input
                placeholder="Plazos de Entrega"
                className="form-control"
                value={form.deliveryTime}
                onChange={(e) =>
                  setForm({ ...form, deliveryTime: e.target.value })
                }
              />
            </div>
            <div className="col-md-6">
              <input
                placeholder="Condiciones de Pago"
                className="form-control"
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm({ ...form, paymentTerms: e.target.value })
                }
              />
            </div>
            <div className="col-md-6">
              <textarea
                placeholder="Consideraciones"
                className="form-control"
                rows={2}
                value={form.considerations}
                onChange={(e) =>
                  setForm({ ...form, considerations: e.target.value })
                }
              ></textarea>
            </div>
          </div>

          <button type="submit" className="btn btn-success w-100">
            Guardar Cotización
          </button>
        </form>
      </div>
    </div>
  );
}
