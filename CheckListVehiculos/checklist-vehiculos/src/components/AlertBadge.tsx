import React from 'react';

interface AlertBadgeProps {
  label: string;
  type: 'warning' | 'danger' | 'info';
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ label, type }) => {
  const badgeClass = type === 'warning' ? 'text-bg-warning' : type === 'danger' ? 'text-bg-danger' : 'text-bg-info';
  const icon = type === 'warning' ? 'bi-exclamation-triangle' : type === 'danger' ? 'bi-exclamation-octagon' : 'bi-info-circle';

  return (
    <span className={`badge ${badgeClass} d-inline-flex align-items-center me-1 mb-1 shadow-sm`}>
      <i className={`bi ${icon} me-1`}></i>
      {label}
    </span>
  );
};

export default AlertBadge;
