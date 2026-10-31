// src/api/supplierPortal.js
//
// Public (token-authed) supplier stock-check portal API — see
// src/pages/SupplierCheckin.jsx. Reuses the same `api` instance as the
// staff dashboard; its auth interceptor only attaches a header when a
// Kinde token-getter has been registered, which this page never does, and
// the backend's /api/supplier-portal routes don't check staff auth anyway.
import api from "./apiClient";

export const fetchPortalItems = (token) => api.get(`/api/supplier-portal/${token}/items`);

export const confirmAllItems = (token, { status, leadTimeDays } = {}) =>
  api.post(`/api/supplier-portal/${token}/confirm-all`, { status, leadTimeDays });

export const confirmItem = (token, { supplierProductId, status, leadTimeDays } = {}) =>
  api.post(`/api/supplier-portal/${token}/confirm-item`, { supplierProductId, status, leadTimeDays });
