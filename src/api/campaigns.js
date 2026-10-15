// src/api/campaigns.js
import api from "./apiClient";

export const fetchCampaignSummary = () => api.get("/api/campaigns/summary");

export const fetchCampaignTriggers = (params = {}) =>
  api.get("/api/campaigns/triggers", { params });

export const fetchCampaignTemplates = (params = {}) =>
  api.get("/api/campaigns/templates", { params });

export const fetchCampaignTemplate = (id) =>
  api.get(`/api/campaigns/templates/${id}`);

export const fetchStaticCampaignTemplate = (scenario) =>
  api.get(`/api/campaigns/static/${scenario}`);

export const approveCampaignTemplate = (id) =>
  api.post(`/api/campaigns/templates/${id}/approve`);

export const rejectCampaignTemplate = (id) =>
  api.post(`/api/campaigns/templates/${id}/reject`);
