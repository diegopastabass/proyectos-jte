import React from 'react';
import { Vehicle } from '../types';
import AlertBadge from './AlertBadge';
import { differenceInDays, parseISO } from 'date-fns';
import SwipeableItem from './SwipeableItem';

interface VehicleCardProps {
  vehicle: Vehicle;
  onStartChecklist: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onStartChecklist, onEdit, onDelete }) => {
  const getDaysDiff = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    return differenceInDays(parseISO(dateStr), new Date());
  };
  
  const getBadgeType = (days: number | null) => {
    if (days === null) return null;
    if (days <= 7) return 'danger';
    if (days <= 30) return 'warning';
    return null;
  };

  const getMaintenanceAlert = () => {
    if (vehicle.km_desde_ultima_mantencion >= 10000) return 'danger';
    if (vehicle.km_desde_ultima_mantencion >= 8000) return 'warning';
    return null;
  };

  const revTecDays = getDaysDiff(vehicle.fecha_venc_revision_tecnica);
  const permCircDays = getDaysDiff(vehicle.fecha_venc_circulacion);
  const mantDays = getDaysDiff(vehicle.fecha_prox_mantencion);
  const maintType = getMaintenanceAlert();

  return (
    <SwipeableItem onSwipeLeft={onEdit} onSwipeRight={onDelete}>
      <div className="glass-card p-3 h-100 d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 className="text-dark mb-0 fw-bold">{vehicle.patente}</h5>
            <div className="text-secondary small">{vehicle.model}</div>
          </div>
          <div className="text-end text-secondary small">
            <div><i className="bi bi-speedometer2 me-1"></i> {vehicle.kilometraje.toLocaleString()} km</div>
          </div>
        </div>

        <div className="mb-3 flex-grow-1">
          {getBadgeType(revTecDays) && <AlertBadge label="Rev. Técnica" type={getBadgeType(revTecDays)! as any} />}
          {getBadgeType(permCircDays) && <AlertBadge label="Perm. Circulación" type={getBadgeType(permCircDays)! as any} />}
          {getBadgeType(mantDays) && <AlertBadge label="Próx. Mantención" type={getBadgeType(mantDays)! as any} />}
          {maintType && <AlertBadge label="Mantención KM" type={maintType as any} />}
        </div>

        <div className="d-flex mt-auto gap-2">
          <button className="btn btn-outline-primary flex-grow-1" onClick={onStartChecklist}>
            <i className="bi bi-card-checklist me-2"></i> Iniciar CheckList
          </button>

          <div className="d-none d-md-flex gap-2">
            {onEdit && (
              <button className="btn btn-outline-secondary px-2" onClick={onEdit} title="Editar">
                <i className="bi bi-pencil"></i>
              </button>
            )}
            {onDelete && (
              <button className="btn btn-outline-danger px-2" onClick={onDelete} title="Eliminar">
                <i className="bi bi-trash"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </SwipeableItem>
  );
};

export default VehicleCard;
