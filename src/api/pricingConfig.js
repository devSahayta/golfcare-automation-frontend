// src/api/pricingConfig.js
import api from "./apiClient";

export const fetchPricingConfig = () => api.get("/api/pricing-config");

export const updatePricingConfig = (changes) =>
  api.put("/api/pricing-config", { changes });

// Option A (confirmed) — single real product, before/after a proposed
// (not-yet-saved) set of changes.
export const previewPricingConfig = (variantId, changes) =>
  api.post("/api/pricing-config/preview", { variantId, changes });
