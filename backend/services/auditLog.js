import { pool } from "../src/db.js";

export async function logAction(userId, action, detail) {
    try {
        await pool.query(
            "INSERT INTO audit_logs(user_id, action, detail) VALUES($1,$2,$3)",
            [userId, action, detail || null]
        );
    } catch (e) {
        console.error("Audit log error:", e.message);
    }
}
