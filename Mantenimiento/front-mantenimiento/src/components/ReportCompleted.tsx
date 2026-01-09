import { PDFDownloadLink } from '@react-pdf/renderer';
import { PDFReport } from './PDFReport';
import { type ReportData } from '../types';

interface Props {
  data: ReportData;
  isAdmin: boolean;
  onBack?: () => void;
}

export const ReportCompleted = ({ data, isAdmin, onBack }: Props) => {
  return (
    <div className="text-center py-5">
      <div className="card border-success shadow-sm d-inline-block p-4" style={{ maxWidth: '500px' }}>
        <div className="mb-3 text-success">
          <i className="bi bi-check-circle-fill" style={{ fontSize: '3rem' }}></i>
        </div>
        <h4 className="card-title text-success">Informe Guardado Correctamente</h4>
        <p className="card-text text-muted mb-4">
          El informe OT-{data.ticket.number} ha sido cerrado y almacenado.
        </p>

        <PDFDownloadLink
          document={<PDFReport data={data} />}
          fileName={`OT-${data.ticket.number}.pdf`}
        >
          {({ loading }) => (
            <button className="btn btn-success btn-lg w-100" disabled={loading}>
              {loading ? (
                <span><span className="spinner-border spinner-border-sm me-2" />Generando PDF...</span>
              ) : (
                <span><i className="bi bi-file-earmark-pdf"></i> Descargar Copia PDF</span>
              )}
            </button>
          )}
        </PDFDownloadLink>

        {isAdmin && (
          <button className="btn btn-outline-secondary mt-3 w-100" onClick={onBack}>
            Volver al Listado
          </button>
        )}
      </div>
    </div>
  );
};