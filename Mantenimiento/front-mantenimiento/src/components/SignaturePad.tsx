import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface Props {
  title: string;
  onSave: (signature: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ title, onSave, onCancel }: Props) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => sigCanvas.current?.clear();

  const save = () => {
    if (sigCanvas.current) {
      // CORRECCIÓN AQUÍ:
      // Usamos getCanvas() en lugar de getTrimmedCanvas() para evitar el error de Vite.
      // Como el fondo es transparente, se verá bien en el PDF de todos modos.
      if (sigCanvas.current.isEmpty()) {
        alert("Por favor realice una firma antes de guardar.");
        return;
      }
      
      const dataURL = sigCanvas.current.getCanvas().toDataURL('image/png');
      onSave(dataURL);
    }
  };

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header bg-light">
        <h6 className="mb-0">{title}</h6>
      </div>
      <div className="card-body d-flex flex-column align-items-center">
        <div style={{ border: '2px solid #ddd', borderRadius: '5px' }}>
          <SignatureCanvas 
            ref={sigCanvas}
            penColor="black"
            canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }}
            backgroundColor="rgba(255, 255, 255, 0)" // Fondo transparente explícito
          />
        </div>
        <small className="text-muted mt-2">Firme dentro del recuadro</small>
        
        <div className="d-flex gap-2 mt-3 w-100 justify-content-center">
          <button className="btn btn-outline-secondary btn-sm" onClick={clear}>
            <i className="bi bi-eraser"></i> Limpiar
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            <i className="bi bi-check-lg"></i> Confirmar Firma
          </button>
           <button className="btn btn-danger btn-sm" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}