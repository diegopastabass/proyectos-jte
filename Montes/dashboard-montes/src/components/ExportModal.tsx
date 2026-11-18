// ExportModal.tsx
import { Modal } from "react-bootstrap";
import Export from "./ExportToExcel";

interface ExportModalProps {
  show: boolean;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ show, onClose }) => (
  <Modal show={show} onHide={onClose} centered>
    <Modal.Header closeButton>
      <Modal.Title as="h5">Exportar historial de datos</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Export onClose={onClose} />
    </Modal.Body>
  </Modal>
);

export default ExportModal;
