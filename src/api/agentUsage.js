// src/api/agentUsage.js
import api from "./apiClient";

export const fetchAgentUsageSummary = (params = {}) =>
  api.get("/api/agent-usage/summary", { params });

export const fetchAgentUsage = (agent, params = {}) =>
  api.get(`/api/agent-usage/${agent}`, { params });
