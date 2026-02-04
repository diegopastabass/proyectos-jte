import { useEffect, useState } from "react";
import { type Quote } from "../types";
import { pdf } from "@react-pdf/renderer"; // Importante
import PDFQuote from "./PDFQuote"; // Importamos el componente PDF

interface Props {
  token: string;
  onCreateClick: () => void;
}

export default function Dashboard({ token, onCreateClick }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isGrid, setIsGrid] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://app.jteanalytics.cl/cotizaciones/quotes", {
      // Ajusta la URL si es prod
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setQuotes(data))
      .catch(console.error);
  }, [token]);

  const handleDelete = (id: string) => {
    // Implementar lógica de eliminación
    console.log("Eliminar", id);
  };

  // Función para manejar la descarga del PDF
  const handleDownloadPDF = async (quote: Quote) => {
    setDownloadingId(quote.id);
    try {
      // Generamos el blob del PDF usando el componente PDFQuote
      const blob = await pdf(<PDFQuote quote={quote} />).toBlob();
      const url = URL.createObjectURL(blob);

      // Creamos un link temporal para descargar
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

  const renderCard = (q: Quote) => (
    <div className={`card mb-3 ${isGrid ? "h-100" : ""}`}>
      <div className="card-body">
        <h5 className="card-title">Folio: {q.folio}</h5>
        <h6 className="card-subtitle mb-2 text-muted">{q.data.clientName}</h6>
        <p className="card-text mb-1">
          <small>Fecha: {new Date(q.created_at).toLocaleDateString()}</small>
        </p>
        <p className="card-text mb-1">
          <small>Total: ${q.data.total.toLocaleString("es-CL")}</small>
        </p>
        <div className="mt-3">
          <button
            className="btn btn-sm btn-danger me-2"
            onClick={() => handleDelete(q.id)}
          >
            <i className="bi bi-trash"></i>
          </button>

          {/* Botón de Descarga */}
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
              <i className="bi bi-file-earmark-pdf"></i>
            )}{" "}
            PDF
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
