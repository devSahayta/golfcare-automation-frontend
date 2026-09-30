// src/api/suppliers.js
import api from "./apiClient";

export const fetchSuppliers = (params = {}) =>
  api.get("/api/suppliers", { params });

export const fetchSupplierById = (id) => api.get(`/api/suppliers/${id}`);
