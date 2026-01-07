import { useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { type ReportData, initialData, type Material } from '../types';
import { PDFReport } from '../components/PDFReport';
import 'bootstrap/dist/css/bootstrap.min.css';
import api from '../api';
import SignaturePad from './SignaturePad'; // Componente de firma

interface Props {
  onBack?: () => void;
  isAdmin: boolean;
}

function ReportForm({ onBack, isAdmin }: Props) {
  const [data, setData] = useState<ReportData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  // Estado para controlar el flujo de la interfaz
  const [step, setStep] = useState<'form' | 'signTech' | 'reviewClient' | 'signClient'>('form');

  // --- MANEJADORES DE ESTADO (Igual que antes) ---
  const handleChange = (field: keyof ReportData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent: 'client' | 'contact', field: string, value: string) => {
    setData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handleSolutionChange = (index: number, value: string) => {
    const newItems = [...data.solutions];
    newItems[index] = value;
    setData(prev => ({ ...prev, solutions: newItems }));
  };
  const addSolution = () => setData(prev => ({ ...prev, solutions: [...prev.solutions, ''] }));
  const removeSolution = (index: number) => {
    if (data.solutions.length === 1) return;
    setData(prev => ({ ...prev, solutions: prev.solutions.filter((_, i) => i !== index) }));
  };

  const handleObservationChange = (index: number, value: string) => {
    const newItems = [...data.observations];
    newItems[index] = value;
    setData(prev => ({ ...prev, observations: newItems }));
  };
  const addObservation = () => setData(prev => ({ ...prev, observations: [...prev.observations, ''] }));
  const removeObservation = (index: number) => {
    if (data.observations.length === 1) return;
    setData(prev => ({ ...prev, observations: prev.observations.filter((_, i) => i !== index) }));
  };

  const handleMaterialChange = (index: number, field: keyof Material, value: any) => {
    const newMats = [...data.materials];
    newMats[index] = { ...newMats[index], [field]: value };
    setData(prev => ({ ...prev, materials: newMats }));
  };
  const addMaterial = () => setData(prev => ({ ...prev, materials: [...prev.materials, { description: '', quantity: 1, cost: 0 }] }));
  const removeMaterial = (index: number) => {
    setData(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }));
  };

  const handleStartClosing = () => {
    if (!data.techName || !data.clientSigner) {
      alert("Por favor ingrese los nombres del técnico y quien recibe antes de firmar.");
      return;
    }
    setStep('signTech');
  };

  const handleTechSign = (signature: string) => {
    setData(prev => ({ ...prev, techSignature: signature }));
    setStep('reviewClient');
  };

  const handleClientApprove = () => {
    setStep('signClient');
  };
  const handleClientSign = async (signature: string) => {
    const finalData = { 
        ...data, 
        clientSignature: signature, 
        isApproved: true 
    };
    setData(finalData);
    
    await saveToDatabase(finalData);
    setStep('form'); 
  };

  const saveToDatabase = async (currentData: ReportData) => {
    try {
      setIsSaving(true);
      await api.post('/reports', {
        ticketNumber: currentData.ticket.number,
        clientName: currentData.client.name,
        status: currentData.status,
        data: currentData 
      });
      return true;
    } catch (error) {
      console.error(error);
      alert('Error al guardar en base de datos. Verifique conexión.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDERIZADO CONDICIONAL ---
  const renderContent = () => {
    switch (step) {
      case 'signTech':
        return (
          <div className="d-flex justify-content-center">
            <SignaturePad 
              title={`Firma Técnico: ${data.techName}`} 
              onSave={handleTechSign} 
              onCancel={() => setStep('form')}
            />
          </div>
        );
      
      case 'reviewClient':
        return (
          <div className="card border-primary">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Revisión del Cliente</h5>
            </div>
            <div className="card-body">
              <h6 className="text-muted">Resumen de trabajos realizados:</h6>
              <div className="alert alert-light border">
                <p className="mb-2"><strong>Diagnóstico:</strong> {data.description}</p>
                <strong>Soluciones:</strong>
                <ul className="mb-0">
                  {data.solutions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              
              <div className="form-check mb-3">
                 <input className="form-check-input" type="checkbox" checked readOnly />
                 <label className="form-check-label">
                    Yo, <strong>{data.clientSigner}</strong>, declaro recibir conforme los trabajos descritos.
                 </label>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary w-50" onClick={() => setStep('form')}>
                    <i className="bi bi-pencil"></i> Corregir
                </button>
                <button className="btn btn-success w-50" onClick={handleClientApprove}>
                    <i className="bi bi-check-lg"></i> Conforme, Firmar
                </button>
              </div>
            </div>
          </div>
        );

      case 'signClient':
        return (
           <div className="d-flex justify-content-center">
            <SignaturePad 
              title={`Firma Cliente: ${data.clientSigner}`} 
              onSave={handleClientSign} 
              onCancel={() => setStep('reviewClient')}
            />
          </div>
        );

      default:
        // EL FORMULARIO ORIGINAL
        return (
          <form onSubmit={(e) => e.preventDefault()}>
            {/* ... (SECCIONES DEL FORMULARIO EXISTENTES: Info, Cliente, Diagnóstico, etc.) ... */}
            {/* Solo pego las secciones finales para abreviar, mantén el resto de inputs igual */}
            
            <h5 className="mb-3">Información General</h5>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Tipo de Atención</label>
                <select className="form-select" value={data.type} onChange={e => handleChange('type', e.target.value)}>
                  <option>Mantención Preventiva</option>
                  <option>Atención de Falla</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Inicio</label>
                <input type="datetime-local" className="form-control" value={data.startDate} onChange={e => handleChange('startDate', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Término</label>
                <input type="datetime-local" className="form-control" value={data.endDate} onChange={e => handleChange('endDate', e.target.value)} />
              </div>
            </div>

            <h5 className="mb-3 mt-4">Datos del Cliente</h5>
            <div className="mb-3">
              <input type="text" className="form-control mb-2" placeholder="Nombre Cliente / Empresa" value={data.client.name} onChange={e => handleNestedChange('client', 'name', e.target.value)} />
              <input type="text" className="form-control mb-2" placeholder="Dirección / Campo" value={data.client.address} onChange={e => handleNestedChange('client', 'address', e.target.value)} />
              <input type="text" className="form-control" placeholder="Equipos" value={data.client.equipment} onChange={e => handleNestedChange('client', 'equipment', e.target.value)} />
            </div>

            <div className="row g-2 mb-3">
               <div className="col-md-4"><input type="text" className="form-control" placeholder="Nombre Contacto" value={data.contact.name} onChange={e => handleNestedChange('contact', 'name', e.target.value)} /></div>
               <div className="col-md-4"><input type="tel" className="form-control" placeholder="Teléfono" value={data.contact.phone} onChange={e => handleNestedChange('contact', 'phone', e.target.value)} /></div>
               <div className="col-md-4"><input type="email" className="form-control" placeholder="Correo" value={data.contact.email} onChange={e => handleNestedChange('contact', 'email', e.target.value)} /></div>
            </div>

            <h5 className="mb-3 mt-4">Diagnóstico</h5>
            <div className="mb-3">
              <select className="form-select mb-3" value={data.status} onChange={e => handleChange('status', e.target.value)}>
                <option>Sin Resolver</option>
                <option>Parcialmente Resuelto</option>
                <option>Resuelto</option>
              </select>
              <textarea className="form-control" rows={4} placeholder="Descripción general..." value={data.description} onChange={e => handleChange('description', e.target.value)} />
            </div>

            <h5 className="mb-3 mt-4">Desarrollo y Solución</h5>
            {data.solutions.map((sol, index) => (
              <div key={index} className="input-group mb-2">
                <span className="input-group-text">{index + 1}</span>
                <input type="text" className="form-control" value={sol} onChange={e => handleSolutionChange(index, e.target.value)} />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeSolution(index)}>X</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addSolution}>+ Item Solución</button>

            <h5 className="mb-3 mt-4">Observaciones Generales</h5>
            {data.observations.map((obs, index) => (
              <div key={index} className="input-group mb-2">
                <span className="input-group-text">•</span>
                <input type="text" className="form-control" placeholder="Observación..." value={obs} onChange={e => handleObservationChange(index, e.target.value)} />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeObservation(index)}>X</button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addObservation}>+ Item Observación</button>

            <h5 className="mb-3 mt-4">Repuestos / Materiales Utilizados (Opcional)</h5>
            {data.materials.length === 0 && (
                <p className="text-muted fst-italic">No se han agregado materiales.</p>
            )}
            {data.materials.map((mat, index) => (
              <div key={index} className="row g-2 mb-2 align-items-center">
                <div className="col-12 col-md-6">
                  <input type="text" className="form-control" placeholder="Descripción del material" 
                    value={mat.description} onChange={e => handleMaterialChange(index, 'description', e.target.value)} />
                </div>
                <div className="col-5 col-md-2">
                  <input type="number" className="form-control" placeholder="Cant." 
                    value={mat.quantity} onChange={e => handleMaterialChange(index, 'quantity', Number(e.target.value))} />
                </div>
                <div className="col-5 col-md-3">
                  <input type="number" className="form-control" placeholder="Costo" 
                    value={mat.cost} onChange={e => handleMaterialChange(index, 'cost', Number(e.target.value))} />
                </div>
                <div className="col-2 col-md-1 text-end">
                  <button type="button" className="btn btn-outline-danger w-100" onClick={() => removeMaterial(index)}>X</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addMaterial}>+ Agregar Material</button>

            {/* SECCIÓN FIRMAS (INPUTS DE TEXTO) */}
            <h5 className="mb-3 mt-4">Firmas</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Técnico</label>
                <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Nombre Técnico" 
                    value={data.techName} 
                    onChange={e => handleChange('techName', e.target.value)}
                    readOnly={data.isApproved} // Bloquear si ya está firmado
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Cliente</label>
                <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Nombre quien recibe" 
                    value={data.clientSigner} 
                    onChange={e => handleChange('clientSigner', e.target.value)}
                    readOnly={data.isApproved} 
                />
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="d-grid gap-2 mt-4 pb-3">
                {!data.isApproved ? (
                    <button type="button" className="btn btn-primary btn-lg" onClick={handleStartClosing}>
                       <i className="bi bi-pen"></i> Iniciar Proceso de Cierre y Firmas
                    </button>
                ) : (
                    <div className="alert alert-success text-center">
                        <h5><i className="bi bi-check-circle-fill"></i> Informe Cerrado y Firmado</h5>
                        <p className="mb-2">El informe ha sido guardado en la base de datos.</p>
                        
                        <PDFDownloadLink 
                            document={<PDFReport data={data} />} 
                            fileName={`OT-${data.ticket.number}.pdf`}
                        >
                          {({ loading }) => (
                            <button className="btn btn-success" disabled={loading}>
                               <i className="bi bi-file-earmark-pdf"></i> Descargar Copia PDF
                            </button>
                          )}
                        </PDFDownloadLink>
                    </div>
                )}
            </div>
          </form>
        );
    }
  };

  return (
    <div className="container py-4">
      {isAdmin && (
        <div className="mb-3">
            <button className="btn btn-outline-secondary" onClick={onBack}>
            <i className="bi bi-arrow-left"></i> Volver al listado
            </button>
        </div>
      )}
      
      <div className="card shadow mb-4">
        <div className="card-body">
            {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default ReportForm;