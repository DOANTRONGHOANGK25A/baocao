import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { pool } from "../src/db.js";

const router = Router();

// GET /api/audit-logs (tất cả user đã đăng nhập — minh bạch)
router.get("/", requireAuth, async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 20));
        const offset = (page - 1) * pageSize;

        const countResult = await pool.query("SELECT COUNT(*) AS total FROM audit_logs");
        const total = Number(countResult.rows[0].total);

        const rows = await pool.query(`
            SELECT a.id, a.action, a.detail, a.created_at,
                   u.username
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        res.json({ ok: true, data: rows.rows, total, page, pageSize });
    } catch (e) {
        next(e);
    }
});

export default router;
