// src/api/productImports.js
import api from "./apiClient";

export const fetchProductImportSummary = () =>
  api.get("/api/product-imports/summary");

export const fetchProductDrafts = (params = {}) =>
  api.get("/api/product-imports/drafts", { params });

export const fetchProductDraft = (id) =>
  api.get(`/api/product-imports/drafts/${id}`);

export const approveProductDraft = (id) =>
  api.post(`/api/product-imports/drafts/${id}/approve`);

export const rejectProductDraft = (id) =>
  api.post(`/api/product-imports/drafts/${id}/reject`);

export const fetchProductImportBatches = (params = {}) =>
  api.get("/api/product-imports/batches", { params });

export const fetchProductImportBatch = (id) =>
  api.get(`/api/product-imports/batches/${id}`);
