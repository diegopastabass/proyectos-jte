import axios from "axios";

const api = axios.create({
  baseURL: "https://app.jteanalytics.cl/zuniga-mediciones/",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("user_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
