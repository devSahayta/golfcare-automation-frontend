// src/api/broadcast-campaigns.js
import api from "./apiClient";

export const listCampaigns = (params = {}) =>
  api.get("/api/broadcast-campaigns", { params });

export const getCampaign = (id) => api.get(`/api/broadcast-campaigns/${id}`);

export const submitCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/submit`);

export const sendCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/send`);

export function scheduleCampaign(id, scheduledAt) {
  return api.post(`/api/broadcast-campaigns/${id}/schedule`, { scheduledAt });
}

export const cancelCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/cancel`);

export const retryCampaign = (id) =>
  api.post(`/api/broadcast-campaigns/${id}/retry`);

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

// Edits the eyebrow/headline/badge wording on an already-generated image
// WITHOUT calling the AI image generator again — re-draws just the text
// layer over the persisted backdrop from the original preview. Near-instant.
export const recomposeCampaignImageText = (payload) =>
  api
    .post("/api/broadcast-campaigns/preview-image/text", payload)
    .then((r) => r.data);

// Path A — deterministic catalog lookup. Checks whether the campaign is
// about one real, named product already in the catalog before any AI
// image generation is attempted.
export const resolveProductImage = (query) =>
  api
    .post("/api/broadcast-campaigns/resolve-product-image", { query })
    .then((r) => r.data);
