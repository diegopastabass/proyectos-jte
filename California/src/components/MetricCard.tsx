import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  barColor: "primary" | "success" | "warning" | "danger" | "info";
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit }) => {
  return (
    <div className="card h-100">
      <div className="card-body p-3">
        <h6 className="card-title text-muted mb-1">{title}</h6>
        <div className="d-flex align-items-center mb-2">
          <h6 className="card-text mb-0 me-1 display-6 fw-bold">
            {String(value)}
          </h6>
          <span className="text-muted fw-light">{unit}</span>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
