import axios, { AxiosError } from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "https://app.jteanalytics.cl/conciliacion",
});

// Interceptor para agregar el token a cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token vencido (dura 8 h) o usuario desactivado: se avisa a la app para que vuelva al login.
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      window.dispatchEvent(new Event("sesion-expirada"));
    }
    return Promise.reject(error);
  },
);

/** Mensaje legible de un error de la API (el filtro de Nest lo deja en message.message). */
export function mensajeError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) return "No se pudo conectar con el servidor. Revise su conexión.";
    const data = error.response.data as { message?: { message?: string | string[] } | string };
    const m = typeof data?.message === "object" ? data.message.message : data?.message;
    if (Array.isArray(m)) return m.join(". ");
    if (m) return m;
    return `Error ${error.response.status}`;
  }
  return error instanceof Error ? error.message : "Error inesperado";
}

export default api;
