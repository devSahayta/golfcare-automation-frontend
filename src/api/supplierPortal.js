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

export const confirmItem = (token, { supplierProductId, status, leadTimeDays, quantity } = {}) =>
  api.post(`/api/supplier-portal/${token}/confirm-item`, { supplierProductId, status, leadTimeDays, quantity });

export const uploadItemImage = (token, supplierProductId, file) => {
  const form = new FormData();
  form.append("image", file);
  return api.post(`/api/supplier-portal/${token}/items/${supplierProductId}/image`, form);
};

export const fetchItemStock = (token, supplierProductId) =>
  api.get(`/api/supplier-portal/${token}/items/${supplierProductId}/stock`);

// `fields` is a plain object of the new-product form's text inputs
// (title, price, marginPercent, gstPercent, brand, category?, sku?,
// specs?, quantity?) — sent as one multipart request alongside the image,
// same shape as uploadItemImage above.
export const createNewProduct = (token, fields, file) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== "") form.append(key, value);
  }
  form.append("image", file);
  return api.post(`/api/supplier-portal/${token}/products`, form);
};
