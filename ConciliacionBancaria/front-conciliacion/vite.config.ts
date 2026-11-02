import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa + HashRouter: el build funciona servido desde cualquier ruta
// (ej. app.jteanalytics.cl/conciliacion-app/) sin configurar reescrituras en el servidor.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
