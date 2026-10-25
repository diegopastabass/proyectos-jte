import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://app.jteanalytics.cl/checklist-vehiculos/",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 60s timeout global (las subidas de fotos usan 120s individual)
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("jwt_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("user_data");
      window.location.hash = "login";
    }
    return Promise.reject(error);
  },
);

export default api;
