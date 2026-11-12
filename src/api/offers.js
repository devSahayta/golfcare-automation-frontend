// src/api/offers.js
import api from "./apiClient";

export const fetchOffers = (params = {}) => api.get("/api/offers", { params });
