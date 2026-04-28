import crypto from "crypto";

const sessions = new Map();

const TTL_MIN = Number(process.env.SESSION_TTL_MINUTES || 480);

export function createSession({ userId, role, username }) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + TTL_MIN * 60 * 1000;

    sessions.set(token, { userId, role, username, expiresAt });
    return token;
}

export function getSession(token) {
    const s = sessions.get(token);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
        sessions.delete(token);
        return null;
    }
    return s;
}

export function deleteSession(token) {
    sessions.delete(token);
}
