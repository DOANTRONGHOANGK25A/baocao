import api from "./api";

export async function searchRecords(type, value) {
    const res = await api.get("/public/search", { params: { type, value } });
    return res.data;
}

export async function verifyOnChain(recordCode) {
    const res = await api.get("/public/verify", { params: { recordCode } });
    return res.data;
}

export async function getPublicRecordFiles(recordId) {
    const res = await api.get(`/public/records/${recordId}/files`);
    return res.data;
}

export async function downloadPublicRecordFile(recordId, fileId) {
    const res = await api.get(`/public/records/${recordId}/files/${fileId}/download`, {
        responseType: "blob",
    });
    return res.data;
}
