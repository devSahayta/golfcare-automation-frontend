// src/api/products.js
import api from "./apiClient";

export const fetchProducts = (params = {}) =>
  api.get("/api/products", { params });

export const fetchProductById = (id) => api.get(`/api/products/${id}`);
