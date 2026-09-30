// src/api/templates.js
import api from "./apiClient";

export const fetchTemplates = () => api.get("/api/templates");
