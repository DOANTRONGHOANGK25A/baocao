import api from "./api";

export async function createRecord(form, files) {
    const fd = new FormData();
    fd.append("recordCode", form.recordCode || "");
    fd.append("title", form.title || "");
    fd.append("category", form.category || "");
    fd.append("ownerName", form.ownerName || "");
    fd.append("description", form.description || "");

    for (const f of files) {
        fd.append("files", f);
    }

    const res = await api.post("/records", fd);
    return res.data;
}

export async function updateRecord(id, form, files) {
    const fd = new FormData();
    fd.append("recordCode", form.recordCode || "");
    fd.append("title", form.title || "");
    fd.append("category", form.category || "");
    fd.append("ownerName", form.ownerName || "");
    fd.append("description", form.description || "");

    if (files && files.length > 0) {
        for (const f of files) {
            fd.append("files", f);
        }
    }

    const res = await api.put(`/records/${id}`, fd);
    return res.data;
}

export async function listRecords({ q = "", status = "", page = 1, pageSize = 20 } = {}) {
    const res = await api.get("/records", { params: { q, status, page, pageSize } });
    return res.data;
}

export async function getRecordById(id) {
    const res = await api.get(`/records/${id}`);
    return res.data;
}

export async function getRecordFiles(id) {
    const res = await api.get(`/records/${id}/files`);
    return res.data;
}

export async function downloadRecordFile(recordId, fileId) {
    const res = await api.get(`/records/${recordId}/files/${fileId}/download`, {
        responseType: "blob",
    });
    return res.data;
}

// STAFF gửi duyệt
export async function submitRecord(id) {
    const res = await api.post(`/records/${id}/submit`);
    return res.data;
}

// MANAGER duyệt — gửi kèm walletData (credentials) để ký blockchain
export async function approveRecord(id, walletData) {
    const res = await api.post(`/records/${id}/approve`, { walletData });
    return res.data;
}

// MANAGER từ chối
export async function rejectRecord(id, reason) {
    const res = await api.post(`/records/${id}/reject`, { reason });
    return res.data;
}

// MANAGER thu hồi — gửi kèm walletData (credentials) để ký blockchain
export async function revokeRecord(id, reason, walletData) {
    const res = await api.post(`/records/${id}/revoke`, { reason, walletData });
    return res.data;
}

export async function getChainLogs(id) {
    const res = await api.get(`/records/${id}/chain-logs`);
    return res.data;
}
