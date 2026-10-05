import React, { useState } from 'react';
import { Vehicle, ChecklistItem, ViewState } from '../types';
import PhotoCaptureModal from './PhotoCaptureModal';
import api from '../api';

interface ChecklistFormProps {
  vehicle: Vehicle | null;
  setViewState: (view: ViewState) => void;
  addToast: (msg: string, type: 'success'|'error'|'warning'|'info') => void;
}

const VISUAL_CONFIG = [
  { id: 'espejos', label: 'Espejos' }, { id: 'neumaticos', label: 'Neumáticos' },
  { id: 'neumaticos_repuesto', label: 'Neumático de repuesto' }, { id: 'cinturones_seguridad', label: 'Cinturones de seguridad' },
  { id: 'set_emergencia', label: 'Set de emergencia' }, { id: 'extintor', label: 'Extintor' },
  { id: 'tablero', label: 'Tablero' }, { id: 'parabrisas', label: 'Parabrisas' },
  { id: 'ventanas', label: 'Ventanas' }, { id: 'pintura', label: 'Pintura' },
  { id: 'limpieza_interior', label: 'Limpieza interior' }, { id: 'otros_visual', label: 'Otros (Visual)' }
];

const MECHANICAL_CONFIG = [
  { id: 'luces', label: 'Luces' }, { id: 'luces_freno', label: 'Luces de Freno' },
  { id: 'intermitentes', label: 'Intermitentes' }, { id: 'frenos', label: 'Frenos' },
  { id: 'freno_mano', label: 'Freno de mano' }, { id: 'limpiaparabrisas', label: 'Limpiaparabrisas' },
  { id: 'deposito_agua', label: 'Depósito de Agua' }, { id: 'otros_mecanico', label: 'Otros (Mecánico)' }
];

const ChecklistForm: React.FC<ChecklistFormProps> = ({ vehicle, setViewState, addToast }) => {
  const initChecks = (config: any[]) => config.reduce((acc, curr) => ({ ...acc, [curr.id]: { id: curr.id, label: curr.label, isGood: true, observation: '', photo: '' } }), {});

  const [visualChecks, setVisualChecks] = useState<Record<string, ChecklistItem>>(initChecks(VISUAL_CONFIG));
  const [mechanicalChecks, setMechanicalChecks] = useState<Record<string, ChecklistItem>>(initChecks(MECHANICAL_CONFIG));
  const [kmActual, setKmActual] = useState<number | ''>('');
  const [kmTouched, setKmTouched] = useState(false);
  const [obsGeneral, setObsGeneral] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhotoId, setCurrentPhotoId] = useState<{ section: 'visual'|'mechanical'|'mandatory'|'interior', id: string } | null>(null);
  const [mandatoryPhotos, setMandatoryPhotos] = useState<{ frontal: string; trasera: string; lateral_izquierdo: string; lateral_derecho: string }>({ frontal: '', trasera: '', lateral_izquierdo: '', lateral_derecho: '' });
  const [interiorPhotos, setInteriorPhotos] = useState<{ interior_1: string; interior_2: string }>({ interior_1: '', interior_2: '' });

  const hasIssues = Object.values(visualChecks).some(c => !c.isGood) || Object.values(mechanicalChecks).some(c => !c.isGood);

  const handleCheck = (section: 'visual'|'mechanical', id: string, isGood: boolean) => {
    const setter = section === 'visual' ? setVisualChecks : setMechanicalChecks;
    setter(prev => ({ ...prev, [id]: { ...prev[id], isGood } }));
  };

  const handleObs = (section: 'visual'|'mechanical', id: string, observation: string) => {
    const setter = section === 'visual' ? setVisualChecks : setMechanicalChecks;
    setter(prev => ({ ...prev, [id]: { ...prev[id], observation } }));
  };

  const handlePhotoCapture = (dataUrl: string) => {
    if (!currentPhotoId) return;
    const { section, id } = currentPhotoId;
    if (section === 'mandatory') {
      setMandatoryPhotos(prev => ({ ...prev, [id]: dataUrl }));
    } else if (section === 'interior') {
      setInteriorPhotos(prev => ({ ...prev, [id]: dataUrl }));
    } else {
      const setter = section === 'visual' ? setVisualChecks : setMechanicalChecks;
      setter(prev => ({ ...prev, [id]: { ...prev[id], photo: dataUrl } }));
    }
    setCurrentPhotoId(null);
  };

  const markAllGood = (section: 'visual'|'mechanical') => {
    const setter = section === 'visual' ? setVisualChecks : setMechanicalChecks;
    setter(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], isGood: true }; });
      return next;
    });
  };

  const [submitting, setSubmitting] = useState(false);

  const dataURLtoBlob = (dataUrl: string): Blob => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const compressImage = (dataUrl: string, maxWidth = 1024, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    // Validar kilometraje
    if (kmActual === '' || kmActual === 0) {
      setKmTouched(true);
      addToast('Debe ingresar el kilometraje actual del vehículo', 'warning');
      return;
    }

    // Validar fotos exteriores obligatorias
    const missingPhotos = [];
    if (!mandatoryPhotos.frontal) missingPhotos.push('Frontal');
    if (!mandatoryPhotos.trasera) missingPhotos.push('Trasera');
    if (!mandatoryPhotos.lateral_izquierdo) missingPhotos.push('Lateral Izquierdo');
    if (!mandatoryPhotos.lateral_derecho) missingPhotos.push('Lateral Derecho');
    if (missingPhotos.length > 0) {
      addToast(`Faltan fotos exteriores obligatorias: ${missingPhotos.join(', ')}`, 'warning');
      return;
    }

    // Validar fotos interiores (mínimo 2)
    const interiorCount = Object.values(interiorPhotos).filter(p => p !== '').length;
    if (interiorCount < 2) {
      addToast(`Debe adjuntar al menos 2 fotos interiores (tiene ${interiorCount})`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Comprimir todas las fotos antes de enviar
      const compressPhoto = async (dataUrl: string): Promise<string> => {
        if (dataUrl && dataUrl.startsWith('data:')) {
          return await compressImage(dataUrl, 1024, 0.6);
        }
        return dataUrl;
      };

      // Comprimir fotos de checks
      const allChecks = { ...visualChecks, ...mechanicalChecks };
      for (const [key, check] of Object.entries(allChecks)) {
        if (check.photo && check.photo.startsWith('data:')) {
          allChecks[key] = { ...check, photo: await compressPhoto(check.photo) };
        }
      }

      // Comprimir fotos exteriores
      const compressedMandatory = {
        frontal: await compressPhoto(mandatoryPhotos.frontal),
        trasera: await compressPhoto(mandatoryPhotos.trasera),
        lateral_izquierdo: await compressPhoto(mandatoryPhotos.lateral_izquierdo),
        lateral_derecho: await compressPhoto(mandatoryPhotos.lateral_derecho),
      };

      // Comprimir fotos interiores
      const compressedInterior = {
        interior_1: await compressPhoto(interiorPhotos.interior_1),
        interior_2: await compressPhoto(interiorPhotos.interior_2),
      };

      const checklistData = {
        vehicle_id: vehicle.id,
        kilometraje_actual: kmActual,
        visual_checks: visualChecks,
        mechanical_checks: mechanicalChecks,
        observaciones_generales: obsGeneral,
        has_issues: hasIssues,
      };

      const formData = new FormData();
      formData.append('data', JSON.stringify(checklistData));

      // Convert compressed check photos to files and append
      Object.entries(allChecks).forEach(([key, check]) => {
        if (check.photo && check.photo.startsWith('data:')) {
          const blob = dataURLtoBlob(check.photo);
          formData.append('files', blob, `${key}.jpg`);
        }
      });

      // Append compressed mandatory exterior photos
      const mandatoryEntries: [string, string][] = [
        ['foto_frontal.jpg', compressedMandatory.frontal],
        ['foto_trasera.jpg', compressedMandatory.trasera],
        ['foto_lateral_izquierdo.jpg', compressedMandatory.lateral_izquierdo],
        ['foto_lateral_derecho.jpg', compressedMandatory.lateral_derecho],
      ];
      mandatoryEntries.forEach(([filename, dataUrl]) => {
        if (dataUrl && dataUrl.startsWith('data:')) {
          const blob = dataURLtoBlob(dataUrl);
          formData.append('files', blob, filename);
        }
      });

      // Append compressed interior photos
      const interiorEntries: [string, string][] = [
        ['foto_interior_1.jpg', compressedInterior.interior_1],
        ['foto_interior_2.jpg', compressedInterior.interior_2],
      ];
      interiorEntries.forEach(([filename, dataUrl]) => {
        if (dataUrl && dataUrl.startsWith('data:')) {
          const blob = dataURLtoBlob(dataUrl);
          formData.append('files', blob, filename);
        }
      });

      await api.post('/checklists', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      addToast('Checklist guardado exitosamente', 'success');
      setViewState('home');
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al guardar checklist. Si hay problemas de conexión, el error se registrará para análisis.';
      addToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
      
      // Log the error
      import('../errorLogger').then(({ logError }) => {
        logError(error);
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderSection = (title: string, config: any[], state: Record<string, ChecklistItem>, sectionType: 'visual'|'mechanical') => (
    <div className="glass-card p-3 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="text-dark m-0">{title}</h5>
        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => markAllGood(sectionType)}>
          <i className="bi bi-check-all me-1"></i> Marcar todo OK
        </button>
      </div>
      <div className="list-group list-group-flush bg-transparent">
        {config.map(item => {
          const val = state[item.id];
          return (
            <div key={item.id} className="list-group-item bg-transparent border-secondary px-0 text-dark">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>{item.label}</span>
                <div className="btn-group" role="group">
                  <button type="button" className={`btn btn-sm ${val.isGood ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => handleCheck(sectionType, item.id, true)}>OK</button>
                  <button type="button" className={`btn btn-sm ${!val.isGood ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => handleCheck(sectionType, item.id, false)}>MALO</button>
                </div>
              </div>
              {!val.isGood && (
                <div className="fade-in mt-2 bg-light p-3 rounded border border-secondary">
                  <textarea className="form-control form-control-sm mb-2" placeholder="Observación (requerida)" value={val.observation} onChange={e => handleObs(sectionType, item.id, e.target.value)} required />
                  <div className="d-flex align-items-center">
                    <button type="button" className="btn btn-sm btn-outline-info me-2" onClick={() => { setCurrentPhotoId({ section: sectionType, id: item.id }); setShowPhotoModal(true); }}>
                      <i className="bi bi-camera me-1"></i> {val.photo ? 'Cambiar Foto' : 'Añadir Foto'}
                    </button>
                    {val.photo && <span className="badge bg-success"><i className="bi bi-check-circle"></i> Foto adjunta</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="container-fluid py-4 fade-in pb-5">
      <button className="btn btn-link text-secondary text-decoration-none mb-3 p-0" onClick={() => setViewState('home')}>
        <i className="bi bi-arrow-left me-1"></i> Volver
      </button>

      <h3 className="text-dark mb-4">Checklist de Vehículo</h3>
      {vehicle && (
        <>
          <div className="glass-card p-3 mb-3 d-flex justify-content-between align-items-center border-primary">
            <div>
              <h5 className="text-dark mb-0">{vehicle.patente}</h5>
              <small className="text-secondary">{vehicle.model}</small>
            </div>
            <span className="badge bg-primary fs-6">
              <i className="bi bi-truck me-1"></i>Checklist
            </span>
          </div>

          <div className={`glass-card p-4 mb-4 ${kmActual === '' && kmTouched ? 'border-danger border-2' : kmActual === '' ? 'border-warning border-2' : 'border-success border-2'}`}>
            <label className="form-label fs-5 fw-bold text-dark d-flex align-items-center mb-3">
              <i className="bi bi-speedometer2 fs-4 me-2 text-primary"></i>
              Kilometraje Actual
              <span className="text-danger ms-1">*</span>
            </label>
            <input
              type="number"
              className={`form-control form-control-lg fs-4 fw-bold text-center ${kmActual === '' && kmTouched ? 'is-invalid' : ''}`}
              placeholder="Ingrese el kilometraje actual"
              value={kmActual}
              onChange={e => {
                const val = e.target.value;
                setKmActual(val === '' ? '' : Number(val));
                setKmTouched(true);
              }}
              min={vehicle.kilometraje || 0}
              required
            />
            <div className="d-flex justify-content-between align-items-center mt-2">
              <small className="text-secondary">
                <i className="bi bi-info-circle me-1"></i>
                Último registrado: <strong>{(vehicle.kilometraje || 0).toLocaleString()} km</strong>
              </small>
              {kmActual === '' && kmTouched && (
                <small className="text-danger fw-bold">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Obligatorio
                </small>
              )}
              {kmActual !== '' && kmActual > 0 && (
                <small className="text-success fw-bold">
                  <i className="bi bi-check-circle me-1"></i>
                  {Number(kmActual).toLocaleString()} km
                </small>
              )}
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
        {renderSection('Inspección Visual', VISUAL_CONFIG, visualChecks, 'visual')}
        {renderSection('Inspección Mecánica', MECHANICAL_CONFIG, mechanicalChecks, 'mechanical')}
        
        {hasIssues && (
          <div className="alert alert-warning fade-in d-flex align-items-center">
            <i className="bi bi-exclamation-triangle fs-4 me-3"></i>
            <div>
              <strong>Atención:</strong> Se han detectado problemas. El vehículo podría no ser apto para circular.
            </div>
          </div>
        )}

        <div className="glass-card p-3 mb-4">
          <label className="form-label text-dark">Observaciones Generales</label>
          <textarea className="form-control" rows={3} value={obsGeneral} onChange={e => setObsGeneral(e.target.value)}></textarea>
        </div>

        <div className="glass-card p-3 mb-4">
          <h5 className="text-dark mb-3">
            <i className="bi bi-camera-fill me-2"></i>Fotos Exteriores Obligatorias
          </h5>
          <p className="text-secondary small mb-3">Debe adjuntar las 4 fotos exteriores del vehículo.</p>
          <div className="row g-3">
            {[
              { id: 'frontal', label: 'Frontal', icon: 'bi-car-front' },
              { id: 'trasera', label: 'Trasera', icon: 'bi-car-front-fill' },
              { id: 'lateral_izquierdo', label: 'Lat. Izquierdo', icon: 'bi-arrow-left-circle' },
              { id: 'lateral_derecho', label: 'Lat. Derecho', icon: 'bi-arrow-right-circle' },
            ].map(photo => (
              <div className="col-6" key={photo.id}>
                <div
                  className={`border rounded p-3 text-center ${(mandatoryPhotos as any)[photo.id] ? 'border-success' : 'border-warning'}`}
                  style={{ minHeight: '120px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  onClick={() => { setCurrentPhotoId({ section: 'mandatory', id: photo.id }); setShowPhotoModal(true); }}
                >
                  {(mandatoryPhotos as any)[photo.id] ? (
                    <>
                      <img src={(mandatoryPhotos as any)[photo.id]} alt={photo.label} className="w-100 rounded" style={{ maxHeight: '100px', objectFit: 'cover' }} />
                      <div className="mt-1">
                        <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>{photo.label}</span>
                      </div>
                    </>
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-warning">
                      <i className={`bi ${photo.icon} fs-1 mb-1`}></i>
                      <small className="fw-bold">{photo.label}</small>
                      <small className="text-danger">* Requerida</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-3 mb-4">
          <h5 className="text-dark mb-3">
            <i className="bi bi-camera-fill me-2"></i>Fotos Interiores
            <span className="text-danger ms-1">*</span>
          </h5>
          <p className="text-secondary small mb-3">
            Debe adjuntar <strong>2 fotos</strong> del interior del vehículo.
            <span className="ms-2 badge bg-secondary">
              {Object.values(interiorPhotos).filter(p => p !== '').length}/2 capturadas
            </span>
          </p>
          <div className="row g-3">
            {[
              { id: 'interior_1', label: 'Interior 1', icon: 'bi-camera' },
              { id: 'interior_2', label: 'Interior 2', icon: 'bi-camera' },
            ].map(photo => (
              <div className="col-6" key={photo.id}>
                <div
                  className={`border rounded p-3 text-center ${(interiorPhotos as any)[photo.id] ? 'border-success' : 'border-warning'}`}
                  style={{ minHeight: '120px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  onClick={() => { setCurrentPhotoId({ section: 'interior', id: photo.id }); setShowPhotoModal(true); }}
                >
                  {(interiorPhotos as any)[photo.id] ? (
                    <>
                      <img src={(interiorPhotos as any)[photo.id]} alt={photo.label} className="w-100 rounded" style={{ maxHeight: '100px', objectFit: 'cover' }} />
                      <div className="mt-1">
                        <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>{photo.label}</span>
                      </div>
                    </>
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-warning">
                      <i className={`bi ${photo.icon} fs-1 mb-1`}></i>
                      <small className="fw-bold">{photo.label}</small>
                      <small className="text-danger">* Requerida</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {Object.values(interiorPhotos).filter(p => p !== '').length < 2 && (
            <div className="alert alert-warning mt-3 mb-0 py-2 d-flex align-items-center">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <small className="fw-bold">Faltan al menos {2 - Object.values(interiorPhotos).filter(p => p !== '').length} foto(s) interior(es)</small>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary w-100 py-3 fw-bold fs-5 shadow-lg mb-4" disabled={submitting}>
          {submitting ? (
            <><span className="spinner-border spinner-border-sm me-2"></span> Guardando...</>
          ) : (
            <><i className="bi bi-save me-2"></i> Guardar Checklist</>
          )}
        </button>
      </form>

      <PhotoCaptureModal show={showPhotoModal} onClose={() => setShowPhotoModal(false)} onCapture={handlePhotoCapture} />
    </div>
  );
};

export default ChecklistForm;
