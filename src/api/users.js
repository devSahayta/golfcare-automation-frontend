// src/api/users.js
import api from "./apiClient";

export const addUserToBackend = (user) =>
  api.post("/api/users", {
    id: user?.id,
    email: user?.email,
    givenName: user?.givenName,
    familyName: user?.familyName,
  });

export const fetchUsers = (params = {}) => api.get("/api/users", { params });

export const fetchUserById = (id) => api.get(`/api/users/${id}`);
