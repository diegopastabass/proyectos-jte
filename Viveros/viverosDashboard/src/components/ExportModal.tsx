import { Modal } from "react-bootstrap";
import type { ZonaConfig } from "../lib/tipos";
import Export from "./ExportToExcel";

interface ExportModalProps {
  show: boolean;
  config: ZonaConfig[];
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ show, config, onClose }) => (
  <Modal show={show} onHide={onClose} centered>
    <Modal.Header closeButton>
      <Modal.Title as="h5">Exportar historial de datos</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Export config={config} onClose={onClose} />
    </Modal.Body>
  </Modal>
);

export default ExportModal;
