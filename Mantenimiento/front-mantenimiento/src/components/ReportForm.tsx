import { useState, useEffect } from "react";
import { type ReportData, initialData, type Material } from "../types";
import "bootstrap/dist/css/bootstrap.min.css";
import api from "../api";
import SignaturePad from "./SignaturePad";

import { ReportEditor } from "./ReportEditor";
import { ClientReview } from "./ClientReview";
import { ReportCompleted } from "./ReportCompleted";

interface Props {
  onBack?: () => void;
  isAdmin: boolean;
  reportId?: string | null;
  cloneData?: ReportData | null;
}

type Step = "form" | "signTech" | "reviewClient" | "signClient" | "completed";

function ReportForm({ onBack, isAdmin, reportId, cloneData }: Props) {
  const [data, setData] = useState<ReportData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<Step>("form");
  // Helper function to get local ISO string
  const getLocalISOString = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  const [createdAt, setCreatedAt] = useState(getLocalISOString());

  useEffect(() => {
    if (reportId) {
      const loadReport = async () => {
        try {
          const res = await api.get(`/app/reports/${reportId}`);
          if (res.data && res.data.data) {
            const loadedData = res.data.data;
            if (!loadedData.developments) {
              loadedData.developments = [""];
            }
            setData(loadedData);
            if (res.data.createdAt) {
              setCreatedAt(getLocalISOString(new Date(res.data.createdAt)));
            }
          }
        } catch (error) {
          console.error(error);
          alert("Error al cargar el informe. Verifique conexión.");
        }
      };
      loadReport();
    } else if (cloneData) {
      // Modo clonado: precargar con datos del informe original (sin firmas, sin OT)
      const cloned = { ...cloneData };
      if (!cloned.developments) {
        cloned.developments = [""];
      }
      setData(cloned);
      // El clon es un informe nuevo: usar fecha actual
      setCreatedAt(getLocalISOString());
    } else {
      setData(initialData);
      setCreatedAt(getLocalISOString());
    }
  }, [reportId, cloneData]);

  const handleChange = (field: keyof ReportData, value: any) =>
    setData((p) => ({ ...p, [field]: value }));
  const handleNestedChange = (
    parent: "client" | "contact",
    field: string,
    value: string,
  ) => setData((p) => ({ ...p, [parent]: { ...p[parent], [field]: value } }));

  const handleSolChange = (idx: number, val: string) => {
    const n = [...data.solutions];
    n[idx] = val;
    setData((p) => ({ ...p, solutions: n }));
  };
  const addSol = () =>
    setData((p) => ({ ...p, solutions: [...p.solutions, ""] }));
  const removeSol = (idx: number) => {
    if (data.solutions.length > 1)
      setData((p) => ({
        ...p,
        solutions: p.solutions.filter((_, i) => i !== idx),
      }));
  };

  const handleObsChange = (idx: number, val: string) => {
    const n = [...data.observations];
    n[idx] = val;
    setData((p) => ({ ...p, observations: n }));
  };
  const addObs = () =>
    setData((p) => ({ ...p, observations: [...p.observations, ""] }));

  const removeObs = (idx: number) => {
    if (data.observations.length > 1)
      setData((p) => ({
        ...p,
        observations: p.observations.filter((_, i) => i !== idx),
      }));
  };
  const handleMatChange = (idx: number, f: keyof Material, v: any) => {
    const n = [...data.materials];
    n[idx] = { ...n[idx], [f]: v };
    setData((p) => ({ ...p, materials: n }));
  };
  const addMat = () =>
    setData((p) => ({
      ...p,
      materials: [...p.materials, { description: "", quantity: 1, cost: 0 }],
    }));
  const removeMat = (idx: number) =>
    setData((p) => ({
      ...p,
      materials: p.materials.filter((_, i) => i !== idx),
    }));

  const handleDevChange = (idx: number, val: string) => {
    const n = [...data.developments];
    n[idx] = val;
    setData((p) => ({ ...p, developments: n }));
  };
  const addDev = () =>
    setData((p) => ({ ...p, developments: [...p.developments, ""] }));
  const removeDev = (idx: number) => {
    if (data.developments.length > 1)
      setData((p) => ({
        ...p,
        developments: p.developments.filter((_, i) => i !== idx),
      }));
  };

  const handleChecklistChange = (
    type: "salaBombas" | "tableroElectrico",
    section: string,
    field: string,
    value: string
  ) => {
    setData((p) => {
      const checklistKey = type === "salaBombas" ? "checklistSalaBombas" : "checklistTableroElectrico";
      const checklist = p[checklistKey] as any;
      if (!checklist) return p;
      return {
        ...p,
        [checklistKey]: {
          ...checklist,
          [section]: {
            ...checklist[section],
            [field]: value,
          },
        },
      };
    });
  };

  const handleStartClosing = () => {
    const isChecklist = data.type === "Mantención Preventiva de Sala de Bombas" || data.type === "Mantención Preventiva de Tablero Eléctrico";

    if (reportId && data.techSignature && (data.clientSignature || isChecklist)) {
      if (
        window.confirm(
          "¿Desea guardar los cambios directamente sin volver a firmar?",
        )
      ) {
        saveToDatabase(data).then((res) => {
          if (res) {
            setData(res);
            setStep("completed");
            alert("Informe actualizado");
          }
        });
        return;
      }
    }
    setStep("signTech");
  };

  const handleTechSign = async (signature: string) => {
    const isChecklist = data.type === "Mantención Preventiva de Sala de Bombas" || data.type === "Mantención Preventiva de Tablero Eléctrico";
    
    if (isChecklist) {
      const finalData = { ...data, techSignature: signature, isApproved: true };
      const savedData = await saveToDatabase(finalData);
      if (savedData) {
        setData(savedData);
        setStep("completed");
      }
    } else {
      setData((prev) => ({ ...prev, techSignature: signature }));
      setStep("reviewClient");
    }
  };

  const handleClientSign = async (signature: string) => {
    const finalData = { ...data, clientSignature: signature, isApproved: true };
    const savedData = await saveToDatabase(finalData);
    if (savedData) {
      setData(savedData);
      setStep("completed");
    }
  };

  const saveToDatabase = async (currentData: ReportData) => {
    try {
      setIsSaving(true);
      let res;
      const payload = {
        ticketNumber: "",
        clientName: currentData.client.name,
        status: currentData.status,
        data: currentData,
        createdAt: new Date(createdAt).toISOString(),
      };

      if (reportId) {
        res = await api.patch(`/app/reports/${reportId}`, payload);
      } else {
        res = await api.post("/app/reports/", payload);
      }

      return res.data.data;
    } catch (error) {
      console.error(error);
      alert("Error al guardar. Verifique conexión.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "form":
        return (
          <ReportEditor
            data={data}
            onChange={handleChange}
            onNestedChange={handleNestedChange}
            onSolutionChange={handleSolChange}
            onAddSolution={addSol}
            onRemoveSolution={removeSol}
            onObservationChange={handleObsChange}
            onAddObservation={addObs}
            onRemoveObservation={removeObs}
            onMaterialChange={handleMatChange}
            onAddMaterial={addMat}
            onRemoveMaterial={removeMat}
            onDevelopmentChange={handleDevChange}
            onAddDevelopment={addDev}
            onRemoveDevelopment={removeDev}
            onSubmit={handleStartClosing}
            isSaving={isSaving}
            onChecklistChange={handleChecklistChange}
            createdAt={createdAt}
            onCreatedAtChange={setCreatedAt}
          />
        );
      case "signTech":
        return (
          <div className="d-flex justify-content-center">
            <SignaturePad
              title={`Firma Técnico: ${data.techName}`}
              onSave={handleTechSign}
              onCancel={() => setStep("form")}
            />
          </div>
        );
      case "reviewClient":
        return (
          <ClientReview
            data={data}
            onCorrect={() => setStep("form")}
            onApprove={() => setStep("signClient")}
          />
        );
      case "signClient":
        return (
          <div className="d-flex justify-content-center">
            <SignaturePad
              title={`Firma Cliente: ${data.clientSigner}`}
              onSave={handleClientSign}
              onCancel={() => setStep("reviewClient")}
            />
          </div>
        );
      case "completed":
        return (
          <ReportCompleted data={data} isAdmin={isAdmin} onBack={onBack} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container py-4">
      {isAdmin && step !== "completed" && (
        <div className="mb-3">
          <button className="btn btn-outline-secondary" onClick={onBack}>
            <i className="bi bi-arrow-left"></i> Volver
          </button>
        </div>
      )}
      {/* Banner informativo al clonar */}
      {cloneData && !reportId && step === "form" && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-3" role="alert">
          <i className="bi bi-copy fs-5"></i>
          <div>
            <strong>Modo Clonado</strong> — Estás creando un nuevo informe basado en uno existente.
            Edita los datos necesarios y completa el proceso de firmas para guardarlo.
          </div>
        </div>
      )}
      <div className="card shadow mb-4">
        <div className="card-body">{renderStep()}</div>
      </div>
    </div>
  );
}

export default ReportForm;
