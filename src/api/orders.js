// src/api/orders.js
//
// The backend paginates by page/limit and returns { data, total }; every
// other screen in this app works in offset/limit and { items, total }.
// Translate here once so pages and <Pagination> stay uniform.
import api from "./apiClient";

export const fetchOrders = ({ limit = 20, offset = 0, ...filters } = {}) =>
  api
    .get("/api/orders", {
      params: { ...filters, limit, page: Math.floor(offset / limit) + 1 },
    })
    .then((res) => ({
      ...res,
      data: { items: res.data.data, total: res.data.total },
    }));

export const fetchOrderById = (id) => api.get(`/api/orders/${id}`);
