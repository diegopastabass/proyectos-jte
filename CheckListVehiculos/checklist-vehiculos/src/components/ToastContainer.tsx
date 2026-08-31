import React, { useEffect } from 'react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container p-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const Toast: React.FC<{ toast: ToastMessage; removeToast: (id: number) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const bgColors = {
    success: 'bg-success',
    error: 'bg-danger',
    warning: 'bg-warning text-dark',
    info: 'bg-info text-dark',
  };

  const icons = {
    success: 'bi-check-circle',
    error: 'bi-exclamation-circle',
    warning: 'bi-exclamation-triangle',
    info: 'bi-info-circle',
  };

  return (
    <div className={`toast show align-items-center text-dark border-0 mb-2 ${bgColors[toast.type]} fade-in`} role="alert" aria-live="assertive" aria-atomic="true">
      <div className="d-flex">
        <div className="toast-body d-flex align-items-center">
          <i className={`bi ${icons[toast.type]} me-2`} style={{ fontSize: '1.2rem' }}></i>
          {toast.message}
        </div>
        <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => removeToast(toast.id)} aria-label="Close"></button>
      </div>
    </div>
  );
};

export default ToastContainer;
