import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { pool } from "../src/db.js";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req, res, next) => {
    try {
        const counts = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status='DRAFT') AS draft,
                COUNT(*) FILTER (WHERE status='PENDING') AS pending,
                COUNT(*) FILTER (WHERE status='CONFIRMED') AS confirmed,
                COUNT(*) FILTER (WHERE status='REJECTED') AS rejected,
                COUNT(*) FILTER (WHERE status='REVOKED') AS revoked
            FROM records
        `);

        const txCount = await pool.query("SELECT COUNT(*) AS total FROM chain_logs");

        const recent = await pool.query(`
            SELECT id, record_code, title, status, created_at
            FROM records ORDER BY created_at DESC LIMIT 5
        `);

        res.json({
            ok: true,
            data: {
                records: counts.rows[0],
                totalChainTx: Number(txCount.rows[0].total),
                recentRecords: recent.rows,
            },
        });
    } catch (e) {
        next(e);
    }
});

export default router;
