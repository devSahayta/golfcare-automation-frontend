// src/api/insights.js
import api from "./apiClient";

export const askInsights = (message, history = []) =>
  api.post("/api/insights/ask", { message, history });
