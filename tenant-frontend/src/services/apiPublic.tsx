import axios from "axios";
import { BASE_URL } from "./api";

// Instancia pública (sin Authorization, sin X-Tenant)
const apiPublic = axios.create({
  baseURL: BASE_URL,
  
});

// Si por error hay token en localStorage, nos aseguramos de quitarlo antes de enviar
apiPublic.interceptors.request.use((config) => {
  if (config.headers) {
    delete config.headers.Authorization;
    delete config.headers["X-Tenant"];
  }
  return config;
});

export default apiPublic;
