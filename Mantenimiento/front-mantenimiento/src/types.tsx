export interface Material {
  description: string;
  quantity: number;
}

export type CheckStatus = "Realizado" | "No Realizado" | "N/A" | "";

export interface ChecklistSalaBombas {
  bombasVariadoresFrecuencia: {
    reaprieteConexionesFuerza: CheckStatus;
    reaprieteConexionesControl: CheckStatus;
    limpiezaComponentesElectronicos: CheckStatus;
    revisionRuidosExtranos: CheckStatus;
    pruebasFuncionamiento: CheckStatus;
  };
  tableroAlimentacion: {
    reaprieteConexionesFuerza: CheckStatus;
    reaprieteConexionesControl: CheckStatus;
    limpiezaComponentesElectricos: CheckStatus;
    pruebasFuncionamiento: CheckStatus;
  };
  parametrosConfiguracion: {
    verificacionControlPID: CheckStatus;
    verificacionMedidorPresion: CheckStatus;
    ajustesParametros: CheckStatus;
    pruebasFuncionamiento: CheckStatus;
  };
}

export interface ChecklistTableroElectrico {
  bombasPartidorSuave: {
    reaprieteConexionesFuerza: CheckStatus;
    reaprieteConexionesControl: CheckStatus;
    limpiezaComponentesElectronicos: CheckStatus;
    revisionRuidosExtranos: CheckStatus;
    pruebasFuncionamiento: CheckStatus;
  };
  tableroAlimentacion: {
    reaprieteConexionesFuerza: CheckStatus;
    reaprieteConexionesControl: CheckStatus;
    limpiezaComponentesElectricos: CheckStatus;
    pruebasFuncionamiento: CheckStatus;
  };
  parametrosConfiguracion: {
    verificacionControlTelemetria: CheckStatus;
    verificacionMedidorCaudal: CheckStatus;
    ajustesParametros: CheckStatus;
    pruebasFuncionamiento: CheckStatus;
  };
}

export type ReportType = "Atención de Falla" | "Mejora en Infraestructura" | "Mantención Preventiva de Sala de Bombas" | "Mantención Preventiva de Tablero Eléctrico";

export const initialData: ReportData = {
  startDate: new Date().toISOString().slice(0, 16),
  endDate: new Date().toISOString().slice(0, 16),
  type: "Atención de Falla",
  client: { name: "", address: "", equipment: "" },
  contact: { name: "", phone: "", email: "" },
  ticket: {
    number: "", // Se deja vacío, el backend lo asignará
    date: new Date().toISOString().split("T")[0],
  },
  status: "Resuelto",
  description: "",
  developments: [""],
  solutions: [""],
  observations: [""],
  materials: [],
  techName: "",
  clientSigner: "",
  techSignature: "",
  clientSignature: "",
  isApproved: false,
  // Campo nuevo: arreglo de imágenes capturadas durante la sesión
  capturedImages: [],
  checklistSalaBombas: {
    bombasVariadoresFrecuencia: {
      reaprieteConexionesFuerza: "",
      reaprieteConexionesControl: "",
      limpiezaComponentesElectronicos: "",
      revisionRuidosExtranos: "",
      pruebasFuncionamiento: "",
    },
    tableroAlimentacion: {
      reaprieteConexionesFuerza: "",
      reaprieteConexionesControl: "",
      limpiezaComponentesElectricos: "",
      pruebasFuncionamiento: "",
    },
    parametrosConfiguracion: {
      verificacionControlPID: "",
      verificacionMedidorPresion: "",
      ajustesParametros: "",
      pruebasFuncionamiento: "",
    },
  },
  checklistTableroElectrico: {
    bombasPartidorSuave: {
      reaprieteConexionesFuerza: "",
      reaprieteConexionesControl: "",
      limpiezaComponentesElectronicos: "",
      revisionRuidosExtranos: "",
      pruebasFuncionamiento: "",
    },
    tableroAlimentacion: {
      reaprieteConexionesFuerza: "",
      reaprieteConexionesControl: "",
      limpiezaComponentesElectricos: "",
      pruebasFuncionamiento: "",
    },
    parametrosConfiguracion: {
      verificacionControlTelemetria: "",
      verificacionMedidorCaudal: "",
      ajustesParametros: "",
      pruebasFuncionamiento: "",
    },
  },
};

export interface User {
  email: string;
  fullName: string;
  role: "0" | "1";
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface ReportSummary {
  id: string;
  clientName: string;
  ticketNumber: string;
  createdAt: string;
  status: string;
}

export interface ReportData {
  startDate: string;
  endDate: string;
  type: ReportType;
  client: {
    name: string;
    address: string;
    equipment: string;
  };
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  ticket: {
    number: string;
    date: string;
  };
  status: "Sin Resolver" | "Parcialmente Resuelto" | "Resuelto";
  description: string;
  developments: string[];
  solutions: string[];
  observations: string[];
  materials: Material[];
  techName: string;
  clientSigner: string;
  techSignature?: string;
  clientSignature?: string;
  isApproved: boolean;
  /**
   * Imágenes capturadas durante la sesión de mantenimiento.
   * Se almacenan como Data URLs (base64) generados desde el canvas del PhotoCaptureModal.
   * Se incluyen en el PDF si el arreglo no está vacío.
   */
  capturedImages: CapturedImage[];
  checklistSalaBombas?: ChecklistSalaBombas;
  checklistTableroElectrico?: ChecklistTableroElectrico;
}

/**
 * Representa una imagen capturada durante la sesión.
 * - id: Identificador único para operaciones de UI (agregar/eliminar).
 * - dataUrl: La imagen en base64 lista para usar en <img> y en @react-pdf/renderer.
 * - fieldId: El ID del campo de contexto (ej: "before", "after", "detail").
 * - fieldLabel: Etiqueta legible para mostrar en la galería y en el PDF.
 * - capturedAt: ISO string del momento de captura para ordenar y mostrar.
 */
export interface CapturedImage {
  id: string;
  dataUrl: string;
  fieldId: string;
  fieldLabel: string;
  capturedAt: string;
}
