// src/api/campaigns.js
import api from "./apiClient";

export const listCampaigns = (params = {}) =>
  api.get("/api/broadcast-campaigns", { params });

export const getCampaign = (id) => api.get(`/api/broadcast-campaigns/${id}`);

export const submitCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/submit`);

export const sendCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/send`);

export const cancelCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/cancel`);

export async function saveCampaignDraft({
  name,
  bodyText,
  audienceRules,
  agentPrompt = "",
}) {
  return api.post("/api/broadcast-campaigns/draft", {
    name,
    bodyText,
    audienceRules,
    agentPrompt,
  });
}

export async function updateCampaignTemplate(id, payload) {
  return api.patch(`/api/broadcast-campaigns/${id}/template`, payload);
}

export const previewCampaignImage = (payload) =>
  api
    .post("/api/broadcast-campaigns/preview-image", payload)
    .then((r) => r.data);
