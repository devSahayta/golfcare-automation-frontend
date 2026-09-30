// src/api/customers.js
import api from "./apiClient";

export const fetchCustomers = (params = {}) =>
  api.get("/api/customers", { params });

export const fetchCustomerById = (id) => api.get(`/api/customers/${id}`);
