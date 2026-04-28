import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../src/db.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { logAction } from "../services/auditLog.js";

const router = Router();
const ALLOWED_ROLES = ["ADMIN", "STAFF", "MANAGER"];

function normalizeUsername(username) {
    return String(username || "").trim();
}

function validateRole(role) {
    return ALLOWED_ROLES.includes(role);
}

function isDuplicateError(error) {
    return error?.code === "23505" || String(error?.message || "").includes("duplicate");
}

// GET /api/users (ADMIN)
router.get("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
    try {
        const r = await pool.query("SELECT id, username, role, created_at FROM users ORDER BY id DESC");
        res.json({ ok: true, data: r.rows });
    } catch (e) {
        next(e);
    }
});

// POST /api/users (ADMIN)
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
    try {
        const { password, role } = req.body || {};
        const username = normalizeUsername(req.body?.username);

        if (!username || !password || !role) {
            return res.status(400).json({ ok: false, message: "Vui lòng nhập tên đăng nhập, mật khẩu và vai trò" });
        }
        if (password.length < 6) {
            return res.status(400).json({ ok: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
        }

        if (!validateRole(role)) {
            return res.status(400).json({ ok: false, message: "Vai trò không hợp lệ" });
        }

        const password_hash = await bcrypt.hash(password, 12);

        const r = await pool.query(
            "INSERT INTO users(username, password_hash, role) VALUES($1,$2,$3) RETURNING id, username, role, created_at",
            [username, password_hash, role]
        );

        await logAction(req.user.id, "CREATE_USER", `Tạo user ${username} (${role})`);
        res.status(201).json({ ok: true, data: r.rows[0] });
    } catch (e) {
        // trùng username => lỗi unique
        if (isDuplicateError(e)) {
            return res.status(409).json({ ok: false, message: "Tên đăng nhập đã tồn tại" });
        }
        next(e);
    }
});

// PUT /api/users/:id (ADMIN)
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        const username = normalizeUsername(req.body?.username);
        const role = req.body?.role;

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ ok: false, message: "Mã người dùng không hợp lệ" });
        }
        if (userId === req.user.id) {
            return res.status(400).json({ ok: false, message: "Không thể chỉnh sửa tài khoản đang đăng nhập tại màn hình này" });
        }
        if (!username || !role) {
            return res.status(400).json({ ok: false, message: "Vui lòng nhập tên đăng nhập và vai trò" });
        }
        if (!validateRole(role)) {
            return res.status(400).json({ ok: false, message: "Vai trò không hợp lệ" });
        }

        const r = await pool.query(
            "UPDATE users SET username=$1, role=$2 WHERE id=$3 RETURNING id, username, role, created_at",
            [username, role, userId]
        );

        if (r.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Không tìm thấy người dùng" });
        }

        res.json({ ok: true, data: r.rows[0] });
    } catch (e) {
        if (isDuplicateError(e)) {
            return res.status(409).json({ ok: false, message: "Tên đăng nhập đã tồn tại" });
        }
        next(e);
    }
});

// PUT /api/users/:id/reset-password (ADMIN)
router.put("/:id/reset-password", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        const newPassword = String(req.body?.newPassword || "");

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ ok: false, message: "Mã người dùng không hợp lệ" });
        }
        if (userId === req.user.id) {
            return res.status(400).json({ ok: false, message: "Hãy dùng chức năng đổi mật khẩu cho tài khoản hiện tại" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ ok: false, message: "Mật khẩu phải có ít nhất 6 ký tự" });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        const r = await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING id", [passwordHash, userId]);

        if (r.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Không tìm thấy người dùng" });
        }

        res.json({ ok: true, message: "Đặt lại mật khẩu thành công" });
    } catch (e) {
        next(e);
    }
});

// DELETE /api/users/:id (ADMIN)
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
    try {
        const userId = Number(req.params.id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ ok: false, message: "Mã người dùng không hợp lệ" });
        }
        if (userId === req.user.id) {
            return res.status(400).json({ ok: false, message: "Không thể xóa tài khoản đang đăng nhập" });
        }

        const dependencyCheck = await pool.query(
            `SELECT EXISTS (
                SELECT 1 FROM records WHERE created_by=$1 OR approved_by=$1
                UNION ALL
                SELECT 1 FROM chain_logs WHERE actor_id=$1
            ) AS has_dependencies`,
            [userId]
        );

        if (dependencyCheck.rows[0]?.has_dependencies) {
            return res.status(409).json({
                ok: false,
                message: "Không thể xóa tài khoản đã phát sinh nghiệp vụ. Hãy chỉnh sửa vai trò hoặc đặt lại mật khẩu nếu cần.",
            });
        }

        const r = await pool.query("DELETE FROM users WHERE id=$1 RETURNING id, username", [userId]);

        if (r.rows.length === 0) {
            return res.status(404).json({ ok: false, message: "Không tìm thấy người dùng" });
        }

        res.json({ ok: true, message: "Xóa người dùng thành công", data: r.rows[0] });
    } catch (e) {
        next(e);
    }
});

export default router;
