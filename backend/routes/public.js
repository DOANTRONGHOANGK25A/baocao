import { Router } from "express";
import { pool } from "../src/db.js";
import { chainRead } from "../services/fabricRecord.js";
import { computeRecordHashByRecordId } from "../services/recordHash.js";

const router = Router();

// ─── GET /api/public/search ─── off-chain search
// query: type = recordCode | ownerName , value = ...
router.get("/search", async (req, res, next) => {
    try {
        const type = (req.query.type || "").trim();
        const value = (req.query.value || "").trim();

        if (!type || !value) {
            return res.status(400).json({ ok: false, message: "Vui lòng nhập loại tìm kiếm và giá trị" });
        }

        let rows = [];
        if (type === "recordCode") {
            const r = await pool.query(
                `SELECT id, record_code, title, category, owner_name, description, status
                 FROM records WHERE record_code = $1 AND status IN ('CONFIRMED', 'REVOKED')`, [value]
            );
            rows = r.rows;
        } else if (type === "ownerName") {
            const r = await pool.query(
                `SELECT id, record_code, title, category, owner_name, description, status
                 FROM records WHERE owner_name ILIKE $1 AND status IN ('CONFIRMED', 'REVOKED') LIMIT 20`, [`%${value}%`]
            );
            rows = r.rows;
        } else if (type === "title") {
            const r = await pool.query(
                `SELECT id, record_code, title, category, owner_name, description, status
                 FROM records WHERE title ILIKE $1 AND status IN ('CONFIRMED', 'REVOKED') LIMIT 20`, [`%${value}%`]
            );
            rows = r.rows;
        } else {
            return res.status(400).json({ ok: false, message: "Loại tìm kiếm phải là recordCode, ownerName hoặc title" });
        }

        const results = rows.map(r => ({
            id: r.id,
            recordCode: r.record_code,
            title: r.title,
            category: r.category,
            ownerName: r.owner_name,
            description: r.description,
            status: r.status,
        }));

        res.json({ ok: true, query: { type, value }, results });
    } catch (e) { next(e); }
});

// ─── GET /api/public/verify?recordCode=... ─── compute hash + đọc on-chain
router.get("/verify", async (req, res, next) => {
    try {
        const recordCode = (req.query.recordCode || "").trim();
        if (!recordCode) return res.status(400).json({ ok: false, message: "Vui lòng nhập mã hồ sơ" });

        const r = await pool.query(
            "SELECT id, record_code, status FROM records WHERE record_code=$1", [recordCode]
        );
        const d = r.rows[0];
        if (!d || (d.status !== 'CONFIRMED' && d.status !== 'REVOKED')) {
            return res.status(404).json({
                ok: false,
                message: "Không tìm thấy hồ sơ hoặc hồ sơ chưa được xác nhận"
            });
        }

        // Tính recordHash off-chain
        let computedRecordHash = null;
        try {
            computedRecordHash = (await computeRecordHashByRecordId(d.id)).recordHash;
        } catch (e) { /* file chưa đủ */ }

        // Đọc on-chain
        let onchain = { exists: false };
        try {
            const oc = await chainRead(d.record_code);
            onchain = {
                exists: true,
                recordCode: oc.recordCode || null,
                recordHash: oc.recordHash || null,
                status: oc.status || null,
                confirmedAt: oc.confirmedAt || null,
                revokedAt: oc.revokedAt || null,
                txId: oc.txId || null,
            };
        } catch (e) { /* chưa ghi on-chain */ }

        const match = Boolean(
            computedRecordHash && onchain.exists && onchain.recordHash && computedRecordHash === onchain.recordHash
        );

        res.json({
            ok: true,
            recordCode: d.record_code,
            computedRecordHash,
            offchainStatus: d.status,
            onchain,
            match,
        });
    } catch (e) { next(e); }
});

// ─── GET /api/public/records/:id/files — danh sách file công khai
router.get("/records/:id/files", async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        const recordCheck = await pool.query("SELECT status FROM records WHERE id=$1", [id]);
        const record = recordCheck.rows[0];
        if (!record || (record.status !== 'CONFIRMED' && record.status !== 'REVOKED')) {
            return res.status(404).json({ ok: false, message: "Không tìm thấy hồ sơ hoặc hồ sơ chưa được xác nhận" });
        }

        const r = await pool.query(
            "SELECT id, filename, mime_type, size_bytes, uploaded_at FROM record_files WHERE record_id=$1 ORDER BY id ASC",
            [id]
        );
        res.json({ ok: true, data: r.rows });
    } catch (e) { next(e); }
});

// ─── GET /api/public/records/:id/files/:fileId/download — tải file công khai
router.get("/records/:id/files/:fileId/download", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const fileId = Number(req.params.fileId);

        const recordCheck = await pool.query("SELECT status FROM records WHERE id=$1", [id]);
        const record = recordCheck.rows[0];
        if (!record || (record.status !== 'CONFIRMED' && record.status !== 'REVOKED')) {
            return res.status(404).json({ ok: false, message: "Không tìm thấy hồ sơ hoặc hồ sơ chưa được xác nhận" });
        }

        const r = await pool.query(
            "SELECT filename, mime_type, data FROM record_files WHERE id=$1 AND record_id=$2",
            [fileId, id]
        );
        const f = r.rows[0];
        if (!f) return res.status(404).json({ ok: false, message: "Không tìm thấy tệp" });

        res.setHeader("Content-Type", f.mime_type || "application/octet-stream");
        res.send(f.data);
    } catch (e) { next(e); }
});

export default router;
