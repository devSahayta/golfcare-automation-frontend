// src/api/auditLogs.js
import api from "./apiClient";

export const fetchAuditLogs = ({ limit = 50, offset = 0, ...filters } = {}) =>
  api
    .get("/api/audit-logs", {
      params: { ...filters, limit, page: Math.floor(offset / limit) + 1 },
    })
    .then((res) => ({
      ...res,
      data: { items: res.data.data, total: res.data.total },
    }));

export const fetchAuditLogMeta = () => api.get("/api/audit-logs/meta");
