import { getSession } from "../src/sessionStore.js";

export function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const [type, token] = auth.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({ ok: false, message: "Thiếu token xác thực" });
    }

    const session = getSession(token);
    if (!session) {
        return res.status(401).json({ ok: false, message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    req.user = { id: session.userId, role: session.role, username: session.username };
    req.token = token;
    next();
}
