export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "operador";
  is_active: boolean;
}

export interface Vehicle {
  id: string;
  model: string;
  patente: string;
  kilometraje: number;
  km_ultima_mantencion: number;
  fecha_venc_revision_tecnica: string; // YYYY-MM-DD
  fecha_venc_circulacion: string;
  fecha_prox_mantencion: string;
  is_active: boolean;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  isGood: boolean;
  observation?: string;
  photo?: string; // base64 or URL
}

export interface Checklist {
  id: number;
  vehiculo_id: number;
  usuario_id: number;
  fecha: string;
  kilometraje_actual: number;
  visual_checks: Record<string, ChecklistItem>;
  mechanical_checks: Record<string, ChecklistItem>;
  has_issues: boolean;
  estado: "aprobado" | "rechazado" | "observado";
  observaciones_generales?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// Mantención cada 10.000 km; avisa desde los 8.000
export const MAINT_INTERVAL_KM = 10000;
export const MAINT_WARNING_KM = 8000;

export type ViewState =
  | "login"
  | "register"
  | "home"
  | "checklist-form"
  | "checklist-list"
  | "checklist-detail";

export interface ToastMessage {
  id: number;
  message: string;
  type: "success" | "error" | "warning" | "info";
}
