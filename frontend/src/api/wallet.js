import api from "./api";

// Tạo wallet mới qua Fabric CA — chỉ cần gọi 1 lần
export async function createWallet() {
    const res = await api.post("/wallet/enroll");
    return res.data;
}
