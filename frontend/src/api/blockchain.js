import api from "./api";

export async function getIntegrityCheck() {
    const res = await api.get("/blockchain/integrity-check");
    return res.data;
}
