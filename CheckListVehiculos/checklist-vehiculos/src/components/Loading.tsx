import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
      <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
        <span className="visually-hidden">Cargando...</span>
      </div>
    </div>
  );
};

export default Loading;
