import React from 'react';

interface ErrorProps {
  message?: string;
  onRetry?: () => void;
}

const Error: React.FC<ErrorProps> = ({ message = 'Ocurrió un error inesperado', onRetry }) => {
  return (
    <div className="container mt-5 text-center fade-in">
      <div className="glass-card p-5 border-danger">
        <i className="bi bi-exclamation-triangle text-danger" style={{ fontSize: '3rem' }}></i>
        <h3 className="mt-3 text-dark">Error</h3>
        <p className="text-secondary">{message}</p>
        {onRetry && (
          <button className="btn btn-outline-light mt-3" onClick={onRetry}>
            Intentar nuevamente
          </button>
        )}
      </div>
    </div>
  );
};

export default Error;
