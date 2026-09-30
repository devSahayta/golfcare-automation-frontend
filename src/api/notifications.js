// src/api/notifications.js
import api from "./apiClient";

export const fetchNotifications = (params = {}) =>
  api.get("/api/notifications", { params });
