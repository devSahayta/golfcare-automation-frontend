// src/api/suppliers.js
import api from "./apiClient";

export const fetchSuppliers = (params = {}) =>
  api.get("/api/suppliers", { params });

export const fetchSupplierById = (id) => api.get(`/api/suppliers/${id}`);

export const fetchCatalogBrands = () => api.get("/api/suppliers/catalog-brands");

export const createSupplier = (data) => api.post("/api/suppliers", data);

export const updateSupplier = (id, data) => api.patch(`/api/suppliers/${id}`, data);

export const deactivateSupplier = (id) => api.delete(`/api/suppliers/${id}`);

export const deleteSupplierPermanently = (id, { force } = {}) =>
  api.delete(`/api/suppliers/${id}/permanent`, {
    params: force ? { force: "true" } : undefined,
  });
