import { useEffect, useState } from "react";
import { type Quote } from "../types";
import { pdf } from "@react-pdf/renderer";
import PDFQuote from "./PDFQuote";
import CreateQuote from "./CreateQuote";
import DeleteConfirmModal from "./DeleteConfimModal";

interface Props {
  token: string;
  onCreateClick: () => void;
  onAuthError: () => void;
}

// Component
export default function Dashboard({
  token,
  onCreateClick,
  onAuthError,
}: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isGrid, setIsGrid] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [deletingQuote, setDeletingQuote] = useState<Quote | null>(null);
  const [duplicatingQuote, setDuplicatingQuote] = useState<Quote | null>(null);

  // fetchQuotes
  const fetchQuotes = () => {
    fetch("https://app.jteanalytics.cl/cotizaciones/quotes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          onAuthError();
          throw new Error("Token expirado");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setQuotes(data);
        } else {
          setQuotes([]);
        }
      })
      .catch((error) => {
        console.error(error);
        setQuotes([]);
      });
  };

  useEffect(() => {
    fetchQuotes();
  }, [token]);

  const handleConfirmDelete = async () => {
    if (!deletingQuote) return;

    try {
      const res = await fetch(
        `https://app.jteanalytics.cl/cotizaciones/quotes/${deletingQuote.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setDeletingQuote(null);
        fetchQuotes();
      } else {
        alert("No se pudo eliminar la cotización");
      }
    } catch (error) {
      alert("Error de conexión al eliminar");
    }
  };

  const handleDownloadPDF = async (quote: Quote) => {
    setDownloadingId(quote.id);
    try {
      const blob = await pdf(<PDFQuote quote={quote} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Cotizacion_${quote.folio}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error al generar PDF", error);
      alert("No se pudo generar el PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  // Renderers
  if (editingQuote || duplicatingQuote) {
    return (
      <CreateQuote
        token={token}
        initialQuote={editingQuote || duplicatingQuote}
        isDuplicate={!!duplicatingQuote}
        onCancel={() => {
          setEditingQuote(null);
          setDuplicatingQuote(null);
        }}
        onSuccess={() => {
          setEditingQuote(null);
          setDuplicatingQuote(null);
          fetchQuotes();
        }}
      />
    );
  }

  const renderCard = (q: Quote) => (
    <div className={`card mb-3 shadow-sm ${isGrid ? "h-100" : ""}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h5 className="card-title text-primary fw-bold">{q.folio}</h5>
          <span className="badge bg-light text-secondary border">
            {new Date(q.created_at).toLocaleDateString()}
          </span>
        </div>

        <h6 className="card-subtitle mb-2 text-dark fw-bold">
          {q.data.clientName}
        </h6>
        <p
          className="card-text mb-2 text-muted text-truncate"
          title={q.data.project}
        >
          <small>
            <i className="bi bi-folder2-open me-1"></i>
            {q.data.project}
          </small>
        </p>
        <p className="card-text mb-3">
          <strong className="text-success fs-5">
            ${q.data.total.toLocaleString("es-CL")}
          </strong>
        </p>

        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
          <div className="btn-group">
            <button
              className="btn btn-outline-warning btn-sm"
              onClick={() => setEditingQuote(q)}
              title="Editar cotización"
            >
              <i className="bi bi-pencil-fill"></i>
            </button>

            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => setDuplicatingQuote(q)}
              title="Duplicar cotización"
            >
              <i className="bi bi-copy"></i>
            </button>

            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => setDeletingQuote(q)}
              title="Eliminar cotización"
            >
              <i className="bi bi-trash-fill"></i>
            </button>
          </div>

          <button
            className="btn btn-sm btn-primary"
            onClick={() => handleDownloadPDF(q)}
            disabled={downloadingId === q.id}
          >
            {downloadingId === q.id ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              <i className="bi bi-file-earmark-pdf me-1"></i>
            )}{" "}
            PDF
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {deletingQuote && (
        <DeleteConfirmModal
          quote={deletingQuote}
          onCancel={() => setDeletingQuote(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Mis Cotizaciones</h2>
        <div>
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => setIsGrid(!isGrid)}
            title="Cambiar vista"
          >
            <i className={`bi ${isGrid ? "bi-list" : "bi-grid"}`}></i>
          </button>
          <button
            className="btn btn-success rounded-circle shadow"
            onClick={onCreateClick}
            title="Nueva cotización"
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="alert alert-info text-center p-5">
          <i className="bi bi-inbox fs-1 d-block mb-3"></i>
          No tienes cotizaciones creadas aún. ¡Crea la primera!
        </div>
      ) : (
        <div
          className={
            isGrid ? "row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4" : ""
          }
        >
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
      )}
    </div>
  );
}
