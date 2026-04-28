import { Router } from "express";
import multer from "multer";
import { pool } from "../src/db.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { chainRead, chainConfirm, chainRevoke } from "../services/fabricRecord.js";
import { computeRecordHashByRecordId } from "../services/recordHash.js";
import { logAction } from "../services/auditLog.js";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype);
        cb(ok ? null : new Error("Loại tệp không được hỗ trợ"), ok);
    },
});

function trim1(s) {
    return (s ?? "").toString().trim();
}

// ---------------------------
// POST /api/records (STAFF) — tạo hồ sơ mới
// ---------------------------
router.post(
    "/",
    requireAuth,
    requireRole("STAFF"),
    upload.array("files", 5),
    async (req, res, next) => {
        const client = await pool.connect();
        try {
            const { recordCode, title, category, ownerName, description } = req.body || {};

            if (!recordCode || !title) {
                return res.status(400).json({ ok: false, message: "Vui lòng nhập mã hồ sơ và tên hồ sơ" });
            }

            const files = req.files || [];
            if (files.length === 0) {
                return res.status(400).json({ ok: false, message: "Vui lòng tải lên ít nhất 1 file đính kèm" });
            }

            await client.query("BEGIN");

            const r1 = await client.query(
                `INSERT INTO records(record_code, title, category, owner_name, description, status, created_by)
                 VALUES($1,$2,$3,$4,$5,'DRAFT',$6)
                 RETURNING id, record_code, title, status, created_at`,
                [trim1(recordCode), trim1(title), trim1(category) || null, trim1(ownerName) || null,
                 trim1(description) || null, req.user.id]
            );

            const record = r1.rows[0];

            for (const f of files) {
                const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');
                await client.query(
                    `INSERT INTO record_files(record_id, filename, mime_type, size_bytes, data)
                     VALUES($1,$2,$3,$4,$5)`,
                    [record.id, safeName, f.mimetype, f.size, f.buffer]
                );
            }

            await client.query("COMMIT");
            await logAction(req.user.id, "CREATE_RECORD", `Tạo hồ sơ ${record.record_code}`);
            res.status(201).json({ ok: true, data: { record, fileCount: files.length } });
        } catch (e) {
            await client.query("ROLLBACK");
            if (String(e?.message || "").includes("duplicate") || String(e?.code || "") === "23505") {
                return res.status(409).json({ ok: false, message: "Mã hồ sơ đã tồn tại" });
            }
            next(e);
        } finally {
            client.release();
        }
    }
);

// ---------------------------
// PUT /api/records/:id (STAFF) — sửa khi DRAFT
// ---------------------------
router.put(
    "/:id",
    requireAuth,
    requireRole("STAFF"),
    upload.array("files", 5),
    async (req, res, next) => {
        const client = await pool.connect();
        try {
            const id = Number(req.params.id);
            const { recordCode, title, category, ownerName, description } = req.body || {};

            await client.query("BEGIN");

            const r0 = await client.query("SELECT id, status FROM records WHERE id=$1 FOR UPDATE", [id]);
            const d0 = r0.rows[0];
            if (!d0) { await client.query("ROLLBACK"); return res.status(404).json({ ok: false, message: "Không tìm thấy" }); }
            if (d0.status !== "DRAFT" && d0.status !== "REJECTED") {
                await client.query("ROLLBACK");
                return res.status(400).json({ ok: false, message: "Chỉ có thể sửa hồ sơ ở trạng thái Nháp hoặc Bị từ chối" });
            }

            if (!recordCode || !title) { await client.query("ROLLBACK"); return res.status(400).json({ ok: false, message: "Vui lòng nhập mã hồ sơ và tên hồ sơ" }); }

            const r = await client.query(
                `UPDATE records
                 SET record_code=$1, title=$2, category=$3, owner_name=$4, description=$5, status='DRAFT', updated_at=now()
                 WHERE id=$6
                 RETURNING id, record_code, title, status, updated_at`,
                [trim1(recordCode), trim1(title), trim1(category) || null, trim1(ownerName) || null,
                 trim1(description) || null, id]
            );

            // Nếu có file mới → xóa file cũ rồi insert mới
            const files = req.files || [];
            if (files.length > 0) {
                await client.query("DELETE FROM record_files WHERE record_id=$1", [id]);
                for (const f of files) {
                    const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');
                    await client.query(
                        `INSERT INTO record_files(record_id, filename, mime_type, size_bytes, data)
                         VALUES($1,$2,$3,$4,$5)`,
                        [id, safeName, f.mimetype, f.size, f.buffer]
                    );
                }
            }

            await client.query("COMMIT");
            await logAction(req.user.id, "EDIT_RECORD", `Sửa hồ sơ ${r.rows[0].record_code}`);
            res.json({ ok: true, data: r.rows[0] });
        } catch (e) {
            await client.query("ROLLBACK");
            if (String(e?.message || "").includes("duplicate") || String(e?.code || "") === "23505") {
                return res.status(409).json({ ok: false, message: "Mã hồ sơ đã tồn tại" });
            }
            next(e);
        } finally {
            client.release();
        }
    }
);

// ---------------------------
// GET /api/records — danh sách + tìm kiếm + phân trang
// ---------------------------
router.get("/", requireAuth, requireRole("ADMIN", "STAFF", "MANAGER"), async (req, res, next) => {
    try {
        const searchKeyword = (req.query.q || "").toString().trim();
        const filterStatus = (req.query.status || "").toString().trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 20));
        const offset = (page - 1) * pageSize;

        const conditions = [];
        const params = [];

        if (filterStatus) {
            params.push(filterStatus);
            conditions.push(`r.status = $${params.length}`);
        }

        if (searchKeyword) {
            params.push(`%${searchKeyword.toLowerCase()}%`);
            const p = `$${params.length}`;
            conditions.push(`(lower(r.record_code) LIKE ${p} OR lower(r.title) LIKE ${p} OR lower(r.owner_name) LIKE ${p})`);
        }

        const whereSql = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

        // Đếm tổng
        const countSql = `SELECT COUNT(*) AS total FROM records r ${whereSql}`;
        const countResult = await pool.query(countSql, params);
        const total = Number(countResult.rows[0].total);

        // Lấy data
        const dataSql = `
            SELECT r.*,
                (SELECT c.tx_id FROM chain_logs c WHERE c.record_id = r.id ORDER BY c.created_at DESC LIMIT 1) AS last_tx_id
            FROM records r
            ${whereSql}
            ORDER BY r.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const result = await pool.query(dataSql, [...params, pageSize, offset]);
        res.json({ ok: true, data: result.rows, total, page, pageSize });
    } catch (e) {
        next(e);
    }
});

// ---------------------------
// GET /api/records/:id — chi tiết
// ---------------------------
router.get("/:id", requireAuth, requireRole("ADMIN", "STAFF", "MANAGER"), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const r = await pool.query(
            `SELECT r.*,
                (SELECT c.tx_id FROM chain_logs c WHERE c.record_id=r.id ORDER BY c.created_at DESC LIMIT 1) AS last_tx_id
             FROM records r WHERE r.id=$1`,
            [id]
        );
        const row = r.rows[0];
        if (!row) return res.status(404).json({ ok: false, message: "Không tìm thấy" });
        res.json({ ok: true, data: row });
    } catch (e) {
        next(e);
    }
});

// ---------------------------
// GET /api/records/:id/files — danh sách file đính kèm (metadata, không có data)
// ---------------------------
router.get("/:id/files", requireAuth, requireRole("ADMIN", "STAFF", "MANAGER"), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const r = await pool.query(
            "SELECT id, record_id, filename, mime_type, size_bytes, uploaded_at FROM record_files WHERE record_id=$1 ORDER BY id ASC",
            [id]
        );
        res.json({ ok: true, data: r.rows });
    } catch (e) {
        next(e);
    }
});

// ---------------------------
// GET /api/records/:id/files/:fileId/download — tải file
// ---------------------------
router.get("/:id/files/:fileId/download", requireAuth, requireRole("ADMIN", "STAFF", "MANAGER"), async (req, res, next) => {
    try {
        const fileId = Number(req.params.fileId);
        const recordId = Number(req.params.id);

        const r = await pool.query(
            "SELECT filename, mime_type, data FROM record_files WHERE id=$1 AND record_id=$2",
            [fileId, recordId]
        );
        const f = r.rows[0];
        if (!f) return res.status(404).json({ ok: false, message: "Không tìm thấy tệp" });

        res.setHeader("Content-Type", f.mime_type || "application/octet-stream");
        res.send(f.data);
    } catch (e) {
        next(e);
    }
});

// ---------------------------
// POST /api/records/:id/submit (STAFF) — gửi duyệt → PENDING
// ---------------------------
router.post("/:id/submit", requireAuth, requireRole("STAFF"), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const r0 = await pool.query("SELECT id, record_code, status FROM records WHERE id=$1", [id]);
        const d = r0.rows[0];
        if (!d) return res.status(404).json({ ok: false, message: "Không tìm thấy" });
        if (d.status !== "DRAFT" && d.status !== "REJECTED") {
            return res.status(400).json({ ok: false, message: "Chỉ có thể gửi duyệt hồ sơ ở trạng thái Nháp hoặc Bị từ chối" });
        }

        const r = await pool.query(
            `UPDATE records SET status='PENDING', updated_at=now() WHERE id=$1
             RETURNING id, record_code, title, status`,
            [id]
        );

        await logAction(req.user.id, "SUBMIT_RECORD", `Gửi duyệt hồ sơ ${d.record_code}`);
        res.json({ ok: true, data: r.rows[0] });
    } catch (e) {
        next(e);
    }
});

// ---------------------------
// POST /api/records/:id/approve (MANAGER) — duyệt + ký blockchain
// Body: { walletData: { credentials: { certificate, privateKey } } }
// ---------------------------
router.post("/:id/approve", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);

        // Validate wallet credentials từ body
        const walletData = req.body?.walletData;
        if (!walletData?.credentials?.certificate || !walletData?.credentials?.privateKey) {
            return res.status(400).json({ ok: false, message: "Vui lòng upload file ví danh tính để ký blockchain" });
        }

        await client.query("BEGIN");

        const r0 = await client.query(
            "SELECT id, record_code, status FROM records WHERE id=$1 FOR UPDATE", [id]
        );
        const d = r0.rows[0];
        if (!d) { await client.query("ROLLBACK"); return res.status(404).json({ ok: false, message: "Không tìm thấy" }); }
        if (d.status !== "PENDING") { await client.query("ROLLBACK"); return res.status(400).json({ ok: false, message: "Chỉ có thể duyệt hồ sơ ở trạng thái Chờ duyệt" }); }

        // Tính recordHash
        const { recordHash } = await computeRecordHashByRecordId(id);

        const recordData = {
            recordHash,
            status: "CONFIRMED",
            confirmedAt: new Date().toISOString(),
        };

        // Ghi on-chain — MANAGER ký bằng credentials upload lên
        const onchain = await chainConfirm(d.record_code, recordData, walletData.credentials);

        const r1 = await client.query(
            `UPDATE records
             SET status='CONFIRMED', approved_by=$1, updated_at=now()
             WHERE id=$2
             RETURNING id, record_code, title, status`,
            [req.user.id, id]
        );

        await client.query(
            `INSERT INTO chain_logs(record_id, actor_id, action, tx_id, record_hash)
             VALUES($1,$2,'CONFIRM',$3,$4)`,
            [id, req.user.id, onchain.txId || null, recordHash]
        );

        await client.query("COMMIT");
        await logAction(req.user.id, "APPROVE_RECORD", `Duyệt hồ sơ ${d.record_code} lên blockchain`);
        res.json({ ok: true, data: { record: r1.rows[0], onchain } });
    } catch (e) {
        await client.query("ROLLBACK");
        next(e);
    } finally {
        client.release();
    }
});

// ---------------------------
// POST /api/records/:id/reject (MANAGER) — từ chối
// ---------------------------
router.post("/:id/reject", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const reason = (req.body?.reason || "").toString().trim();

        const r0 = await pool.query("SELECT id, record_code, status FROM records WHERE id=$1", [id]);
        const d = r0.rows[0];
        if (!d) return res.status(404).json({ ok: false, message: "Không tìm thấy" });
        if (d.status !== "PENDING") return res.status(400).json({ ok: false, message: "Chỉ có thể từ chối hồ sơ ở trạng thái Chờ duyệt" });

        const r = await pool.query(
            `UPDATE records SET status='REJECTED', revoke_reason=$1, approved_by=$2, updated_at=now()
             WHERE id=$3 RETURNING id, record_code, title, status`,
            [reason || null, req.user.id, id]
        );

        await logAction(req.user.id, "REJECT_RECORD", `Từ chối hồ sơ ${d.record_code}: ${reason}`);
        res.json({ ok: true, data: r.rows[0] });
    } catch (e) {
        next(e);
    }
});

// ---------------------------
// POST /api/records/:id/revoke (MANAGER) — thu hồi
// Body: { reason, walletData: { credentials: { certificate, privateKey } } }
// ---------------------------
router.post("/:id/revoke", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const id = Number(req.params.id);
        const reason = (req.body?.reason || "").toString().trim();

        // Validate wallet credentials từ body
        const walletData = req.body?.walletData;
        if (!walletData?.credentials?.certificate || !walletData?.credentials?.privateKey) {
            return res.status(400).json({ ok: false, message: "Vui lòng upload file ví danh tính để ký blockchain" });
        }

        await client.query("BEGIN");

        const r0 = await client.query(
            "SELECT id, record_code, status FROM records WHERE id=$1 FOR UPDATE", [id]
        );
        const d = r0.rows[0];
        if (!d) { await client.query("ROLLBACK"); return res.status(404).json({ ok: false, message: "Không tìm thấy" }); }
        if (d.status !== "CONFIRMED") { await client.query("ROLLBACK"); return res.status(400).json({ ok: false, message: "Chỉ có thể thu hồi hồ sơ đã xác nhận" }); }

        // Đọc on-chain
        const before = await chainRead(d.record_code);

        // Thu hồi on-chain — MANAGER ký bằng credentials upload lên
        const onchain = await chainRevoke(d.record_code, new Date().toISOString(), walletData.credentials);

        const r1 = await client.query(
            `UPDATE records
             SET status='REVOKED', revoke_reason=$1, approved_by=$2, updated_at=now()
             WHERE id=$3
             RETURNING id, record_code, title, status`,
            [reason || null, req.user.id, id]
        );

        await client.query(
            `INSERT INTO chain_logs(record_id, actor_id, action, tx_id, record_hash)
             VALUES($1,$2,'REVOKE',$3,$4)`,
            [id, req.user.id, onchain.txId || null, before.recordHash || null]
        );

        await client.query("COMMIT");
        await logAction(req.user.id, "REVOKE_RECORD", `Thu hồi hồ sơ ${d.record_code}: ${reason}`);
        res.json({ ok: true, data: { record: r1.rows[0], onchain } });
    } catch (e) {
        await client.query("ROLLBACK");
        next(e);
    } finally {
        client.release();
    }
});

// ---------------------------
// GET /api/records/:id/chain-logs
// ---------------------------
router.get("/:id/chain-logs", requireAuth, requireRole("ADMIN", "STAFF", "MANAGER"), async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const r = await pool.query(
            "SELECT action, tx_id, record_hash, created_at FROM chain_logs WHERE record_id=$1 ORDER BY created_at ASC",
            [id]
        );
        res.json({ ok: true, data: r.rows });
    } catch (e) { next(e); }
});

export default router;
