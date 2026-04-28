import api from "./api";

export async function getDashboardStats() {
    const res = await api.get("/dashboard/stats");
    return res.data;
}
