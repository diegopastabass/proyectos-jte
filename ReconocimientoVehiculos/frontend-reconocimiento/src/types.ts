export interface User {
  id: number;
  username: string;
  rol: string;
  isActive: boolean;
  token?: string;
}

export interface RecognitionResult {
  status: "registrado" | "no_reconocido" | "sin_patente";
  patente?: string;
  message?: string;
  persona?: {
    id: number;
    nombre: string;
  };
}

export interface Persona {
  id: number;
  nombre: string;
}

export interface Vehicle {
  id: number;
  patente: string;
  personaId: number;
  persona: Persona;
}
