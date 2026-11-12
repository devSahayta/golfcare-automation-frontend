// src/api/escalations.js
import api from "./apiClient";

export const fetchEscalations = (params = {}) =>
  api.get("/api/escalations", { params });
