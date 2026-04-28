import api from "./api";

export async function listUsers() {
    const res = await api.get("/users");
    return res.data;
}

export async function createUser(payload) {
    const res = await api.post("/users", payload);
    return res.data;
}

export async function updateUser(id, payload) {
    const res = await api.put(`/users/${id}`, payload);
    return res.data;
}

export async function resetUserPassword(id, newPassword) {
    const res = await api.put(`/users/${id}/reset-password`, { newPassword });
    return res.data;
}

export async function deleteUser(id) {
    const res = await api.delete(`/users/${id}`);
    return res.data;
}