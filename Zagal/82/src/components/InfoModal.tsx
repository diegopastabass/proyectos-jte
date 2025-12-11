import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";

interface InfoModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  text1?: string;
  text2?: string;
  text3?: string;
  text4?: string;
  children?: React.ReactNode;
}

const InfoModal: React.FC<InfoModalProps> = ({
  show,
  onClose,
  title,
  text1,
  text2,
  text3,
  text4,
  children,
}) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <p>{text1}</p>
            <p>{text2}</p>
            <p>{text3}</p>
            <p>{text4}</p>
            {children}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
