import React, { useState, useEffect, useRef } from 'react';
import { Vehicle, ChecklistItem, ViewState } from '../types';
import PhotoCaptureModal from './PhotoCaptureModal';
import api from '../api';
import { saveDraft, loadDraft, clearDraft } from '../utils/draftStore';

// Un salto de odómetro mayor a esto pide confirmación (posible error de tipeo)
const KM_JUMP_CONFIRM = 2000;

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

const INVALID_PHOTO_MSG = 'Una de las fotos está vacía o dañada. Vuelva a tomarla e intente nuevamente.';

const ChecklistForm: React.FC<ChecklistFormProps> =({ vehicle, setViewState, addToast }) => {
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

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const draftReady = useRef(false);

  // Sin vehículo (pestaña recargada sin datos): volver al inicio con aviso en vez de perder el trabajo en silencio
  useEffect(() => {
    if (!vehicle) {
      addToast('Seleccione un vehículo para iniciar el checklist', 'warning');
      setViewState('home');
    }
  }, []);

  // Restaurar borrador (incluidas fotos) si la pestaña se recargó a mitad del checklist
  useEffect(() => {
    if (!vehicle) return;
    loadDraft<any>(vehicle.id).then((d) => {
      if (d) {
        setVisualChecks(d.visualChecks ?? initChecks(VISUAL_CONFIG));
        setMechanicalChecks(d.mechanicalChecks ?? initChecks(MECHANICAL_CONFIG));
        setKmActual(d.kmActual ?? '');
        setObsGeneral(d.obsGeneral ?? '');
        setMandatoryPhotos(d.mandatoryPhotos ?? { frontal: '', trasera: '', lateral_izquierdo: '', lateral_derecho: '' });
        setInteriorPhotos(d.interiorPhotos ?? { interior_1: '', interior_2: '' });
        addToast('Se recuperó su checklist en progreso', 'info');
      }
      draftReady.current = true;
    });
  }, []);

  // Guardar borrador (con pausa para no escribir en cada tecla)
  useEffect(() => {
    if (!vehicle || !draftReady.current) return;
    const t = setTimeout(() => {
      saveDraft(vehicle.id, { visualChecks, mechanicalChecks, kmActual, obsGeneral, mandatoryPhotos, interiorPhotos });
    }, 800);
    return () => clearTimeout(t);
  }, [visualChecks, mechanicalChecks, kmActual, obsGeneral, mandatoryPhotos, interiorPhotos]);

  const hasIssues = Object.values(visualChecks).some(c => !c.isGood) || Object.values(mechanicalChecks).some(c => !c.isGood);

  const handleCheck = (section: 'visual'|'mechanical', id: string, isGood: boolean) => {
    const setter = section === 'visual' ? setVisualChecks : setMechanicalChecks;
    // Un ítem OK no lleva foto: si se corrige de MALO a OK, se descarta la foto
    setter(prev => ({ ...prev, [id]: { ...prev[id], isGood, ...(isGood ? { photo: '' } : {}) } }));
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
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !arr[1]) throw new Error(INVALID_PHOTO_MSG);
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    if (u8arr.length === 0) throw new Error(INVALID_PHOTO_MSG);
    return new Blob([u8arr], { type: mime });
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

    // Cada ítem MALO necesita observación
    const missingObs = [...Object.values(visualChecks), ...Object.values(mechanicalChecks)]
      .filter(c => !c.isGood && !(c.observation || '').trim());
    if (missingObs.length > 0) {
      addToast(`Falta la observación en: ${missingObs.map(c => c.label).join(', ')}`, 'warning');
      return;
    }

    if (Number(kmActual) < (vehicle.kilometraje || 0)) {
      addToast(`El kilometraje no puede ser menor al último registrado (${(vehicle.kilometraje || 0).toLocaleString()} km)`, 'warning');
      return;
    }
    const jump = Number(kmActual) - (vehicle.kilometraje || 0);
    if (jump > KM_JUMP_CONFIRM && !window.confirm(`El kilometraje aumentó ${jump.toLocaleString()} km desde el último registro. ¿Es correcto?`)) {
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
    let uploadedFileCount = 0;
    try {
      // Las fotos ya se comprimen al capturarlas (PhotoCaptureModal)
      const allChecks = { ...visualChecks, ...mechanicalChecks };
      const compressedMandatory = mandatoryPhotos;
      const compressedInterior = interiorPhotos;

      // Limpiar fotos base64 del JSON para no exceder el límite de tamaño de campo
      // Las fotos ya viajan como archivos binarios en el FormData
      const cleanChecks = (checks: Record<string, ChecklistItem>) => {
        const cleaned: Record<string, any> = {};
        for (const [key, check] of Object.entries(checks)) {
          const { photo, ...rest } = check;
          cleaned[key] = { ...rest, hasPhoto: !check.isGood && !!photo };
        }
        return cleaned;
      };

      const checklistData = {
        vehicle_id: vehicle.id,
        kilometraje_actual: kmActual,
        visual_checks: cleanChecks(visualChecks),
        mechanical_checks: cleanChecks(mechanicalChecks),
        observaciones_generales: obsGeneral,
        has_issues: hasIssues,
      };

      const formData = new FormData();
      formData.append('data', JSON.stringify(checklistData));

      // Convert compressed check photos to files and append
      Object.entries(allChecks).forEach(([key, check]) => {
        if (!check.isGood && check.photo && check.photo.startsWith('data:')) {
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

      uploadedFileCount = formData.getAll('files').length;

      // No pasar Content-Type manual: el navegador genera el boundary automáticamente
      // Timeout de 120s para subidas con muchas fotos en conexiones lentas
      setUploadPct(0);
      await api.post('/checklists', formData, {
        timeout: 120000,
        onUploadProgress: (ev) => {
          if (ev.total) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
        },
      });
      draftReady.current = false;
      await clearDraft(vehicle.id);

      addToast('Checklist guardado exitosamente', 'success');
      setViewState('home');
    } catch (error: any) {
      let msg: string;
      if (!error?.isAxiosError) {
        msg = error?.message || 'Error al preparar las fotos.';
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        msg = 'La conexión tardó demasiado. Verifique su conexión a internet e intente nuevamente.';
      } else if (!error?.response) {
        msg = 'No se pudo conectar con el servidor. Verifique su conexión a internet e intente nuevamente.';
      } else {
        const st = error?.response?.status;
        const m = error?.response?.data?.message;
        msg = st === 413 ? 'Las fotos pesan demasiado para el servidor (413). Avise al administrador.'
          : st === 401 ? 'Su sesión venció. Inicie sesión de nuevo; su checklist quedó guardado como borrador.'
          : (Array.isArray(m) ? m.join('. ') : m) || 'Error al guardar checklist.';
      }
      addToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
      
      // Log the error con más contexto
      import('../errorLogger').then(({ logError }) => {
        const errorDetail = {
          message: error?.message,
          code: error?.code,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: error?.config?.url,
          fileCount: uploadedFileCount,
        };
        logError(JSON.stringify(errorDetail));
      });
    } finally {
      setSubmitting(false);
      setUploadPct(null);
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
            <><span className="spinner-border spinner-border-sm me-2"></span> {uploadPct !== null ? `Subiendo fotos… ${uploadPct}%` : 'Guardando...'}</>
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
