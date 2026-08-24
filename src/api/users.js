// src/api/users.js
import api from "./apiClient";

export const addUserToBackend = (user) =>
  api.post("/api/users", {
    id: user?.id,
    email: user?.email,
    givenName: user?.givenName,
    familyName: user?.familyName,
  });

export const fetchUsers = () => api.get("/api/users");

export const fetchUserById = (id) => api.get(`/api/users/${id}`);
