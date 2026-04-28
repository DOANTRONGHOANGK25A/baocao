import api from "./api";

export async function getAuditLogs({ page = 1, pageSize = 20 } = {}) {
    const res = await api.get("/audit-logs", { params: { page, pageSize } });
    return res.data;
}
