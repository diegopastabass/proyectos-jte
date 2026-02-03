import { useEffect, useState } from "react";
import { type Quote } from "../types";

interface Props {
  token: string;
  onCreateClick: () => void;
}

export default function Dashboard({ token, onCreateClick }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isGrid, setIsGrid] = useState(false);

  useEffect(() => {
    fetch("https://app.jteanalytics.cl/cotizaciones/quotes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setQuotes(data))
      .catch(console.error);
  }, [token]);

  const handleDelete = (id: string) => {
    // Implementar lógica de eliminación si el backend lo soporta
    console.log("Eliminar", id);
  };

  const renderCard = (q: Quote) => (
    <div className={`card mb-3 ${isGrid ? "h-100" : ""}`}>
      <div className="card-body">
        <h5 className="card-title">Folio: {q.folio}</h5>
        <h6 className="card-subtitle mb-2 text-muted">{q.data.clientName}</h6>
        <p className="card-text mb-1">
          <small>Fecha: {new Date(q.created_at).toLocaleDateString()}</small>
        </p>
        <p className="card-text mb-1">
          <small>Total: ${q.data.total.toLocaleString()}</small>
        </p>
        <div className="mt-3">
          <button
            className="btn btn-sm btn-danger me-2"
            onClick={() => handleDelete(q.id)}
          >
            <i className="bi bi-trash"></i>
          </button>
          <button className="btn btn-sm btn-primary">
            <i className="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Mis Cotizaciones</h2>
        <div>
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => setIsGrid(!isGrid)}
          >
            <i className={`bi ${isGrid ? "bi-list" : "bi-grid"}`}></i>
          </button>
          <button
            className="btn btn-success rounded-circle"
            onClick={onCreateClick}
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>

      <div className={isGrid ? "row row-cols-1 row-cols-md-3 g-4" : ""}>
        {quotes.map((q) =>
          isGrid ? (
            <div className="col" key={q.id}>
              {renderCard(q)}
            </div>
          ) : (
            <div key={q.id}>{renderCard(q)}</div>
          ),
        )}
      </div>
    </div>
  );
}
